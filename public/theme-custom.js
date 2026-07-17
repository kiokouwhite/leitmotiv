/**
 * theme-custom.js — helper partagé par TOUS les overlays.
 *
 * Un « thème custom » (créé dans le theme maker) n'a pas de nom de thème
 * dédié (overlayTheme reste 'default') : il est défini par une palette de
 * 4 couleurs { primary, secondary, white, black }. Ce helper permet à chaque
 * overlay de dériver ses couleurs depuis cette palette sans dupliquer la logique.
 *
 * Usage dans un overlay :
 *   1) inclure <script src="/theme-custom.js"></script> AVANT le JS de l'overlay
 *   2) dans le handler stateUpdate :
 *        applyTheme(window.themeNameFromState(s));
 *   3) dans getColors(theme) :
 *        if (theme && theme.indexOf('__custom__') === 0) {
 *          const cc = window.customThemeColors();
 *          if (cc) return cc;
 *        }
 *
 * themeNameFromState renvoie une clé unique par palette (« __custom__<primary><secondary> »)
 * quand un thème custom est actif — ce qui « busts » le garde `theme === currentTheme`
 * des overlays et force la ré-application quand la palette change.
 */
(function () {
  'use strict';
  var _pal = null;

  function _hexToRgba(hex, a) {
    hex = String(hex || '').replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var r = parseInt(hex.substr(0, 2), 16) || 0,
        g = parseInt(hex.substr(2, 2), 16) || 0,
        b = parseInt(hex.substr(4, 2), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  window._themeHexToRgba = _hexToRgba;

  // Met à jour la palette courante et renvoie le nom de thème à appliquer :
  // clé custom unique si thème custom actif, sinon le thème nommé (ou 'default').
  window.themeNameFromState = function (s) {
    if (s && s.customThemeActive && s.themePalette) {
      _pal = s.themePalette;
      return '__custom__' + (_pal.primary || '') + (_pal.secondary || '');
    }
    _pal = null;
    return (s && s.overlayTheme) || 'default';
  };

  // Couleurs dérivées de la palette custom (forme compatible avec les
  // THEME_COLORS des overlays : { primary, glow, bg, secondary, text, accent }).
  window.customThemeColors = function () {
    if (!_pal) return null;
    return {
      primary:   _pal.primary,
      secondary: _pal.secondary,
      accent:    _pal.primary,
      glow:      _hexToRgba(_pal.secondary, 0.55),
      bg:        _hexToRgba(_pal.black, 0),
      text:      _pal.white,
      white:     _pal.white,
      black:     _pal.black,
    };
  };
})();
