/*
 * RouteHQ booking box for a rental business's own website.
 *
 *   <div data-routehq-booking="your-shop"></div>
 *   <script src="https://routehq.app/embed.js" async></script>
 *
 * Optional on the div: data-lang="th" (or en, zh, ru…), data-vehicle="<vehicle id>" to open on one vehicle.
 * The box shows the business's vehicles, prices and free dates and grows to fit; booking continues on RouteHQ,
 * where the customer adds documents and signs.
 */
(function () {
  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "https://routehq.app";

  function mount(box) {
    if (box.getAttribute("data-routehq-mounted")) return;
    var slug = (box.getAttribute("data-routehq-booking") || "").trim();
    if (!/^[a-z0-9-]{2,80}$/i.test(slug)) return;
    box.setAttribute("data-routehq-mounted", "1");
    var params = new URLSearchParams({ embed: "1" });
    var lang = box.getAttribute("data-lang");
    var vehicle = box.getAttribute("data-vehicle");
    if (lang) params.set("lang", lang);
    if (vehicle) params.set("vehicle", vehicle);
    var frame = document.createElement("iframe");
    frame.src = origin + "/rent/" + encodeURIComponent(slug) + "?" + params.toString();
    frame.title = "Book a vehicle";
    frame.loading = "lazy";
    frame.setAttribute("allow", "clipboard-write");
    frame.style.cssText = "width:100%;min-height:520px;border:0;display:block;background:transparent;color-scheme:light";
    box.appendChild(frame);
    window.addEventListener("message", function (event) {
      if (event.origin !== origin || event.source !== frame.contentWindow || !event.data) return;
      if (event.data.type === "routehq:height" && typeof event.data.height === "number") frame.style.height = Math.max(320, Math.ceil(event.data.height)) + "px";
      // Booking made: carry on at RouteHQ in the same tab (documents and signing need the whole screen).
      if (event.data.type === "routehq:continue" && typeof event.data.href === "string" && event.data.href.indexOf(origin + "/book/") === 0) window.location.assign(event.data.href);
    });
  }

  function mountAll() {
    var boxes = document.querySelectorAll("[data-routehq-booking]");
    for (var i = 0; i < boxes.length; i++) mount(boxes[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
