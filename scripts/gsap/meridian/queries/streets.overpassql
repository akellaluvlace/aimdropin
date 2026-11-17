[out:json][timeout:120];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](53.3340,-6.3020,53.3660,-6.1880);
  way["building"](53.3445,-6.2860,53.3525,-6.2700);
  way["natural"="water"](53.3400,-6.3020,53.3560,-6.1880);
  way["waterway"="riverbank"](53.3400,-6.3020,53.3560,-6.1880);
  relation["natural"="water"](53.3400,-6.3020,53.3560,-6.1880);
  way["leisure"="park"](53.3340,-6.3020,53.3660,-6.1880);
  way["railway"="tram"](53.3340,-6.3020,53.3660,-6.1880);
);
out geom;
