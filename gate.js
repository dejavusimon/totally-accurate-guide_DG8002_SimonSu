/* B.P.R.D. clearance check — gate.js
   Loaded WITHOUT defer in the <head> of index.html and classified.html, so
   it runs before the page is drawn. Visitors who haven't signed in at the
   Records Terminal this session are sent there first, which makes the
   terminal the opening page of the site. (All other behaviour lives in
   script.js, which is loaded with defer.) */

(function checkClearance() {
  let agentName;
  try {
    agentName = sessionStorage.getItem("bprd-agent");
  } catch (error) {
    return;   // browser storage is blocked: let the visitor in rather than loop
  }
  if (!agentName) {
    window.location.replace("system.html#clearance-required");
  }
})();
