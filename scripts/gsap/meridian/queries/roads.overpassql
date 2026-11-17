[out:json][timeout:120];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link)$"](53.2001,-6.5000,53.4752,-5.8500);
  way["waterway"="river"](53.2001,-6.5000,53.4752,-5.8500);
  way["railway"="rail"](53.2001,-6.5000,53.4752,-5.8500);
  way["natural"="coastline"](53.2001,-6.5000,53.4752,-5.8500);
);
out geom;
