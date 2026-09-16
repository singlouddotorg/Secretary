// Minutes — application version.
//
// One literal, in a file small enough to have no other reason to change, loaded by both
// minutes.html and instructions.html so the running app and the page describing it cannot
// disagree. That disagreement is not hypothetical: Instructions once sat six revisions
// behind the app, in exactly the page someone reads while writing a bug report.
//
// This used to live in shared-utils.js, which solved the same problem while every app
// shared one repository. It cannot stay there now: Tunebooks carries its own copy of
// shared-utils.js, and would have been carrying Minutes' version number with it. Each app
// in the Sing Loud Suite versions itself - Simple Minutes has no business being at Minutes'
// number just because they were released together.
//
// Kept as a plain global-scope script, not a module, for the same reason as every other
// file here: `import`/`export` are blocked by browsers on file:// URLs, and this suite's
// whole promise is that you double-click a file and it works.
(function(global){
  "use strict";
  var MINUTES_VERSION = "1.0.0-beta.108";
  var api = { VERSION: MINUTES_VERSION, SCHEMA_VERSION: "5" };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.EZMinutesVersion = api;
})(typeof window !== "undefined" ? window : this);
