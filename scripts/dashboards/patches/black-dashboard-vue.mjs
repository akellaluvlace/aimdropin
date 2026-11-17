// Vue Black Dashboard: publicPath and history routing at the demo base;
// Google Maps can't load in the demo sandbox.
import { vueCliPublicPath, vueRouter3History, dropGoogleMapsScript, guardMapsMounted } from "./_vue.mjs";
vueCliPublicPath();
vueRouter3History("src/router/index.js");
dropGoogleMapsScript();
guardMapsMounted("src/pages/Maps.vue");
