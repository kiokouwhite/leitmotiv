// ============================================================================
//  Leitmotiv — Télécommande de score (app native Nintendo 3DS, homebrew)
//  Palier 1 (M1) : se connecte au serveur PC en WiFi (réseau local) et permet
//  d'incrémenter / décrémenter le score de chaque joueur + remise à zéro.
//
//  Le serveur expose (déjà testé) :
//    GET  /api/remote/state   -> {"p1tag","p1name","p1score","p2tag","p2name","p2score"}
//    POST /api/remote/score    body {"player":1|2,"delta":+1|-1}
//    POST /api/remote/reset
//
//  ⚠️  METS L'IP DE TON PC + LE PORT CI-DESSOUS (visible dans le log de démarrage
//      du serveur, ex. "http://192.168.1.103:3002/control").
// ============================================================================

#include <3ds.h>
#include <citro2d.h>

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdarg.h>
#include <malloc.h>

#include <sys/socket.h>
#include <sys/time.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

// ===================== CONFIG : À ADAPTER =====================
#define SERVER_HOST "192.168.1.103"   // <-- IP de ton PC sur le réseau local
#define SERVER_PORT 3002              // <-- port du serveur Leitmotiv
// =============================================================

#define SOC_ALIGN       0x1000
#define SOC_BUFFERSIZE  0x100000      // 1 Mio, aligné sur 0x1000 (requis par socInit)

static u32 *s_socBuffer = NULL;

// ---------------------------------------------------------------------------
//  État affiché (rempli depuis /api/remote/state)
// ---------------------------------------------------------------------------
typedef struct {
    char p1tag[48], p1name[64];
    char p2tag[48], p2name[64];
    int  p1score, p2score;
    int  ok;            // 1 si la dernière lecture a réussi
} MatchState;

static MatchState g_state;
static char g_status[128] = "Demarrage...";

// ---------------------------------------------------------------------------
//  HTTP minimal (HTTP/1.1, Connection: close) via sockets BSD
//  Retourne le nombre d'octets reçus (>=0) ou un code négatif en cas d'erreur.
//  `resp` reçoit la RÉPONSE COMPLÈTE (en-têtes + corps).
// ---------------------------------------------------------------------------
static int http_request(const char *method, const char *path,
                        const char *json_body, char *resp, int resp_size) {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) return -1;

    // Timeout best-effort (évite un blocage long si le serveur ne répond pas).
    struct timeval tv; tv.tv_sec = 3; tv.tv_usec = 0;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

    struct sockaddr_in sa;
    memset(&sa, 0, sizeof(sa));
    sa.sin_family      = AF_INET;
    sa.sin_port        = htons(SERVER_PORT);
    sa.sin_addr.s_addr = inet_addr(SERVER_HOST);

    if (connect(sock, (struct sockaddr *)&sa, sizeof(sa)) < 0) {
        close(sock);
        return -2;
    }

    char req[1024];
    int n;
    if (json_body) {
        n = snprintf(req, sizeof(req),
            "%s %s HTTP/1.1\r\n"
            "Host: %s:%d\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: %d\r\n"
            "Connection: close\r\n\r\n%s",
            method, path, SERVER_HOST, SERVER_PORT, (int)strlen(json_body), json_body);
    } else {
        n = snprintf(req, sizeof(req),
            "%s %s HTTP/1.1\r\n"
            "Host: %s:%d\r\n"
            "Connection: close\r\n\r\n",
            method, path, SERVER_HOST, SERVER_PORT);
    }

    if (send(sock, req, n, 0) < 0) { close(sock); return -3; }

    int total = 0;
    while (total < resp_size - 1) {
        int r = recv(sock, resp + total, resp_size - 1 - total, 0);
        if (r <= 0) break;           // 0 = connexion fermée par le serveur
        total += r;
    }
    resp[total] = '\0';
    close(sock);
    return total;
}

// Renvoie un pointeur sur le corps (après l'en-tête \r\n\r\n) ou la chaîne complète.
static const char *http_body(const char *resp) {
    const char *b = strstr(resp, "\r\n\r\n");
    return b ? b + 4 : resp;
}

// ---------------------------------------------------------------------------
//  Parsing JSON « à plat » (clés simples, pas d'objet imbriqué)
// ---------------------------------------------------------------------------
static int json_get_int(const char *json, const char *key, int fallback) {
    char pat[64];
    snprintf(pat, sizeof(pat), "\"%s\"", key);
    const char *p = strstr(json, pat);
    if (!p) return fallback;
    p += strlen(pat);
    while (*p && (*p == ':' || *p == ' ')) p++;
    return (int)strtol(p, NULL, 10);
}

static void json_get_str(const char *json, const char *key, char *out, int out_size) {
    out[0] = '\0';
    char pat[64];
    snprintf(pat, sizeof(pat), "\"%s\"", key);
    const char *p = strstr(json, pat);
    if (!p) return;
    p += strlen(pat);
    while (*p && (*p == ':' || *p == ' ')) p++;
    if (*p != '"') return;           // on attend une chaîne entre guillemets
    p++;
    int i = 0;
    while (*p && *p != '"' && i < out_size - 1) out[i++] = *p++;
    out[i] = '\0';
}

// ---------------------------------------------------------------------------
//  Appels API
// ---------------------------------------------------------------------------
static char g_resp[8192];

static void fetch_state(void) {
    int r = http_request("GET", "/api/remote/state", NULL, g_resp, sizeof(g_resp));
    if (r < 0) {
        g_state.ok = 0;
        snprintf(g_status, sizeof(g_status), "Erreur reseau (%d) - verifie IP/port/WiFi", r);
        return;
    }
    const char *body = http_body(g_resp);
    json_get_str(body, "p1tag",  g_state.p1tag,  sizeof(g_state.p1tag));
    json_get_str(body, "p1name", g_state.p1name, sizeof(g_state.p1name));
    json_get_str(body, "p2tag",  g_state.p2tag,  sizeof(g_state.p2tag));
    json_get_str(body, "p2name", g_state.p2name, sizeof(g_state.p2name));
    g_state.p1score = json_get_int(body, "p1score", 0);
    g_state.p2score = json_get_int(body, "p2score", 0);
    g_state.ok = 1;
    snprintf(g_status, sizeof(g_status), "Connecte a %s:%d", SERVER_HOST, SERVER_PORT);
}

static void post_score(int player, int delta) {
    char body[64];
    snprintf(body, sizeof(body), "{\"player\":%d,\"delta\":%d}", player, delta);
    int r = http_request("POST", "/api/remote/score", body, g_resp, sizeof(g_resp));
    if (r < 0) { g_state.ok = 0; snprintf(g_status, sizeof(g_status), "Erreur envoi (%d)", r); return; }
    fetch_state();
}

static void post_reset(void) {
    int r = http_request("POST", "/api/remote/reset", "{}", g_resp, sizeof(g_resp));
    if (r < 0) { g_state.ok = 0; snprintf(g_status, sizeof(g_status), "Erreur reset (%d)", r); return; }
    fetch_state();
}

// ---------------------------------------------------------------------------
//  UI — boutons tactiles (écran du bas : 320 x 240)
// ---------------------------------------------------------------------------
typedef enum { ACT_P1_DEC, ACT_P1_INC, ACT_P2_DEC, ACT_P2_INC, ACT_RESET, ACT_REFRESH, ACT_COUNT } Action;

typedef struct { float x, y, w, h; const char *label; u32 color; } Button;

static Button g_btn[ACT_COUNT];

static void buttons_init(void) {
    const u32 cMinus = C2D_Color32(0xC0, 0x39, 0x39, 0xFF);   // rouge
    const u32 cPlus  = C2D_Color32(0x2E, 0x9E, 0x4E, 0xFF);   // vert
    const u32 cGray  = C2D_Color32(0x55, 0x55, 0x60, 0xFF);
    const u32 cGold  = C2D_Color32(0xC9, 0x9A, 0x2E, 0xFF);

    // Joueur 1 (rangée haute), Joueur 2 (rangée basse)
    g_btn[ACT_P1_DEC] = (Button){  12,  44, 140, 60, "- 1", cMinus };
    g_btn[ACT_P1_INC] = (Button){ 168,  44, 140, 60, "+ 1", cPlus  };
    g_btn[ACT_P2_DEC] = (Button){  12, 116, 140, 60, "- 1", cMinus };
    g_btn[ACT_P2_INC] = (Button){ 168, 116, 140, 60, "+ 1", cPlus  };
    g_btn[ACT_RESET]  = (Button){  12, 188, 140, 44, "RESET",   cGray };
    g_btn[ACT_REFRESH]= (Button){ 168, 188, 140, 44, "ACTUALISER", cGold };
}

static int button_hit(float px, float py) {
    for (int i = 0; i < ACT_COUNT; i++) {
        Button *b = &g_btn[i];
        if (px >= b->x && px <= b->x + b->w && py >= b->y && py <= b->y + b->h)
            return i;
    }
    return -1;
}

static void do_action(int act) {
    switch (act) {
        case ACT_P1_DEC: post_score(1, -1); break;
        case ACT_P1_INC: post_score(1, +1); break;
        case ACT_P2_DEC: post_score(2, -1); break;
        case ACT_P2_INC: post_score(2, +1); break;
        case ACT_RESET:  post_reset();      break;
        case ACT_REFRESH:fetch_state();     break;
    }
}

// ---------------------------------------------------------------------------
//  Dessin
// ---------------------------------------------------------------------------
static C2D_TextBuf g_textBuf;

static void draw_text(float x, float y, float scale, u32 color, const char *fmt, ...) {
    char buf[160];
    va_list ap; va_start(ap, fmt); vsnprintf(buf, sizeof(buf), fmt, ap); va_end(ap);
    C2D_Text t;
    C2D_TextParse(&t, g_textBuf, buf);
    C2D_TextOptimize(&t);
    C2D_DrawText(&t, C2D_WithColor, x, y, 0.0f, scale, scale, color);
}

int main(int argc, char **argv) {
    // --- init graphismes ---
    gfxInitDefault();
    C3D_Init(C3D_DEFAULT_CMDBUF_SIZE);
    C2D_Init(C2D_DEFAULT_MAX_OBJECTS);
    C2D_Prepare();
    C3D_RenderTarget *top = C2D_CreateScreenTarget(GFX_TOP, GFX_LEFT);
    C3D_RenderTarget *bot = C2D_CreateScreenTarget(GFX_BOTTOM, GFX_LEFT);
    g_textBuf = C2D_TextBufNew(8192);

    // --- init réseau ---
    s_socBuffer = (u32 *)memalign(SOC_ALIGN, SOC_BUFFERSIZE);
    int socOk = (s_socBuffer && R_SUCCEEDED(socInit(s_socBuffer, SOC_BUFFERSIZE)));
    if (!socOk) snprintf(g_status, sizeof(g_status), "Echec init reseau (socInit)");

    buttons_init();
    memset(&g_state, 0, sizeof(g_state));
    strcpy(g_state.p1name, "PLAYER 1");
    strcpy(g_state.p2name, "PLAYER 2");

    if (socOk) fetch_state();

    const u32 clrBgTop = C2D_Color32(0x10, 0x10, 0x16, 0xFF);
    const u32 clrBgBot = C2D_Color32(0x0A, 0x0A, 0x10, 0xFF);
    const u32 clrWhite = C2D_Color32(0xF0, 0xEE, 0xF8, 0xFF);
    const u32 clrMuted = C2D_Color32(0x88, 0x88, 0x95, 0xFF);
    const u32 clrGold  = C2D_Color32(0xE8, 0xB8, 0x30, 0xFF);
    const u32 clrGreen = C2D_Color32(0x6B, 0xC9, 0x6C, 0xFF);
    const u32 clrRed   = C2D_Color32(0xE0, 0x6B, 0x6B, 0xFF);

    int frame = 0;

    while (aptMainLoop()) {
        hidScanInput();
        u32 kDown = hidKeysDown();
        if (kDown & KEY_START) break;          // START = quitter

        if ((kDown & KEY_TOUCH) && socOk) {
            touchPosition touch;
            hidTouchRead(&touch);
            int act = button_hit((float)touch.px, (float)touch.py);
            if (act >= 0) do_action(act);
        }

        // Rafraîchissement périodique (~ toutes les 3 s) pour refléter les changements PC.
        // Gardé seulement si la dernière lecture a réussi → si le serveur est down,
        // on ne re-tente pas en boucle (l'utilisateur relance via ACTUALISER).
        if (socOk && g_state.ok && (++frame % 180) == 0) fetch_state();

        C2D_TextBufClear(g_textBuf);

        C3D_FrameBegin(C3D_FRAME_SYNCDRAW);

        // ---------- ÉCRAN HAUT (400 x 240) : scores ----------
        C2D_TargetClear(top, clrBgTop);
        C2D_SceneBegin(top);
        draw_text(10, 8, 0.6f, clrGold, "LEITMOTIV - Score 3DS");
        draw_text(10, 226, 0.42f, g_state.ok ? clrMuted : clrRed, "%s", g_status);

        // Joueur 1 (gauche)
        draw_text(20, 70, 0.6f, clrWhite, "%s%s",
                  g_state.p1tag[0] ? g_state.p1tag : "", g_state.p1tag[0] ? " " : "");
        draw_text(20, 92, 0.55f, clrWhite, "%s", g_state.p1name);
        draw_text(60, 120, 2.4f, clrGreen, "%d", g_state.p1score);

        // Séparateur
        draw_text(196, 120, 1.4f, clrMuted, "-");

        // Joueur 2 (droite)
        draw_text(230, 70, 0.6f, clrWhite, "%s%s",
                  g_state.p2tag[0] ? g_state.p2tag : "", g_state.p2tag[0] ? " " : "");
        draw_text(230, 92, 0.55f, clrWhite, "%s", g_state.p2name);
        draw_text(280, 120, 2.4f, clrGreen, "%d", g_state.p2score);

        // ---------- ÉCRAN BAS (320 x 240) : boutons tactiles ----------
        C2D_TargetClear(bot, clrBgBot);
        C2D_SceneBegin(bot);
        draw_text(12, 6, 0.5f, clrWhite, "%s  (J1)", g_state.p1name);
        draw_text(12, 92, 0.5f, clrWhite, "%s  (J2)", g_state.p2name);

        for (int i = 0; i < ACT_COUNT; i++) {
            Button *b = &g_btn[i];
            C2D_DrawRectSolid(b->x, b->y, 0.0f, b->w, b->h, b->color);
            // libellé approximativement centré
            float tx = b->x + b->w / 2.0f - (float)strlen(b->label) * 4.5f;
            float ty = b->y + b->h / 2.0f - 10.0f;
            draw_text(tx, ty, 0.6f, clrWhite, "%s", b->label);
        }

        C3D_FrameEnd(0);
    }

    // --- cleanup ---
    C2D_TextBufDelete(g_textBuf);
    C2D_Fini();
    C3D_Fini();
    gfxExit();
    if (socOk) socExit();
    if (s_socBuffer) free(s_socBuffer);
    return 0;
}
