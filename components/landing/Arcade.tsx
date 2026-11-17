// The landing page's wolf: an original pixel-art character drawn from the
// studio's faceted wolf mark, in the site's four colours. The page is its
// level: it leaps into the hero and runs to its spot, runs along the tops of
// the four step cards, howls in the dark section, waits on the last button
// and sleeps in the footer. The step cards and the fine-print cards carry
// small pixel drawings in the same style.
//
// Everything here is decoration: aria-hidden and no layout of its own. Each
// scene plays once when it scrolls into view (RevealObserver's .rv-in) and
// then holds still; pointing at the wolf plays a trick. Under
// prefers-reduced-motion nothing moves and each scene shows its resting
// pose. The styles, and each sprite's size, are in app/arcade.css; the
// images are strips of frames in public/sprites. The only script is the
// game of fetch (WolfPlay.tsx), in the hero and the footer.
//
// One sprite pixel is two screen pixels everywhere (the site's border
// width), so the wolf comes in two drawings: the full one for the scenes
// where it is the subject, and a half-size one ("sm") for where it is small.

type Sprite =
  | "wolf-run-sm"
  | "wolf-sit-sm"
  | "wolf-jump-sm"
  | "wolf-roll-sm"
  | "wolf-sleep-sm"
  | "wolf-bow-sm"
  | "wolf-look-sm"
  | "wolf-wake-sm"
  | "wolf-sit-sm-gold"
  | "wolf-sit-gold"
  | "wolf-jump-gold"
  | "wolf-howl-moon"
  | "disc"
  | "moon"
  | "star-big"
  | "star-small";

function Px({ name, className }: { name: Sprite; className?: string }) {
  return <span className={`px px-${name}${className ? ` ${className}` : ""}`} />;
}

// A sprite that takes part in a scene: the holder is placed and timed (where
// it is, when it shows), the sprite inside plays its frames. Two elements, so
// that pointing at the wolf can restart its frames without restarting the
// scene.
function Actor({ name, className }: { name: Sprite; className: string }) {
  return (
    <span className={`actor ${className}`}>
      <Px name={name} />
    </span>
  );
}

// The frisbee's speech bubble: how to play, shown when it is pointed at (only
// where the game is on: see .yard-tip in app/arcade.css).
function YardTip() {
  return <span className="yard-tip">Click and hold to throw</span>;
}

// The wolf the game drives: one sprite for each pose it can take, one above
// the other, and WolfPlay shows the one in use. They are all on the page from
// the start, hidden, so every strip is loaded before a game begins. (A single
// sprite whose image was swapped had to ask the server at each new pose, and
// the wolf vanished until the answer came.) Keep in step with POSES in
// WolfPlay.tsx.
const YARD_POSES: Sprite[] = ["wolf-sit-sm", "wolf-run-sm", "wolf-jump-sm", "wolf-bow-sm", "wolf-look-sm", "wolf-wake-sm"];
function YardWolf() {
  return (
    <span className="actor yard-wolf">
      {YARD_POSES.map((name) => (
        <Px key={name} name={name} />
      ))}
    </span>
  );
}

// Hero: the wolf leaps in from beyond the left edge, runs along the section's
// bottom rule, turns a somersault on the way and sits beside the frisbee that
// lies there. Pointing at it makes it somersault. The strip is a "yard":
// WolfPlay.tsx runs the game of fetch in it, with .yard-wolf (a wolf it drives
// itself) and .yard-disc (the frisbee and the area around it that can be
// grabbed).
export function HeroGround() {
  return (
    <div className="yard lvl-ground" data-yard="hero" data-reveal="scene" aria-hidden="true">
      <span className="actor lvl-enter">
        <Px name="wolf-jump-sm" className="lvl-pose lvl-leap" />
        <Px name="wolf-run-sm" className="lvl-pose lvl-run" />
        <Px name="wolf-roll-sm" className="lvl-pose lvl-roll" />
      </span>
      <span className="actor yard-rest lvl-sit">
        <Px name="wolf-sit-sm" className="lvl-still" />
        <Px name="wolf-roll-sm" className="lvl-trick" />
      </span>
      <span className="yard-disc lvl-disc">
        <Px name="disc" />
        <YardTip />
      </span>
      <YardWolf />
    </div>
  );
}

// How it works: the wolf hops up from behind the first step card, runs along
// the tops of all four and sits on the last. Render it right after the list
// of steps: it starts when the list is revealed.
export function StepsRunner() {
  return (
    <div className="steps-run" aria-hidden="true">
      <Actor name="wolf-jump-sm" className="steps-up" />
      <Actor name="wolf-run-sm" className="steps-dash" />
      <span className="actor steps-sit">
        <Px name="wolf-sit-sm" className="steps-still" />
        <Px name="wolf-jump-sm" className="steps-jump" />
      </span>
    </div>
  );
}

// A card's drawing: a strip of frames that assembles the picture once, as the
// card arrives, and then holds the finished frame (no replays). On the step
// cards it waits for the wolf to run past.
export type CardArtName = "pick" | "preview" | "remix" | "ship" | "licence" | "checked" | "trackers" | "source";

export function CardArt({ name, className }: { name: CardArtName; className?: string }) {
  return <span className={`px art px-art-${name}${className ? ` ${className}` : ""}`} data-reveal="art" aria-hidden="true" />;
}

// The fine print (the dark section): a moon, a few stars and the wolf,
// moonlit, howling.
export function NightScene() {
  return (
    <div className="night" data-reveal="scene" aria-hidden="true">
      <Px name="moon" className="night-moon" />
      <Px name="star-big" className="night-star night-star-a" />
      <Px name="star-small" className="night-star night-star-b" />
      <Px name="star-small" className="night-star night-star-c" />
      <Px name="star-small" className="night-star night-star-d" />
      <Px name="star-big" className="night-star night-star-e" />
      <Actor name="wolf-howl-moon" className="night-wolf" />
    </div>
  );
}

// Final banner, wide screens: the wolf sits on the first button and jumps
// when either button is pointed at. Render it inside the buttons' wrapper.
// On the coral banner it wears a yellow scarf; its own would not show. The
// jump is a second sprite, hidden until then: both strips are loaded from the
// start, so the first jump does not wait for its image.
export function CtaWolf() {
  return (
    <span className="cta-wolf cta-wolf-big" aria-hidden="true">
      <Px name="wolf-sit-gold" className="cta-sit" />
      <Px name="wolf-jump-gold" className="cta-jump" />
    </span>
  );
}

// Final banner, narrow screens: the small wolf waits in the corner, on the
// banner's bottom rule.
export function CtaWolfSmall() {
  return (
    <span className="cta-wolf cta-wolf-small" data-reveal="scene" aria-hidden="true">
      <Px name="wolf-sit-sm-gold" />
    </span>
  );
}

// Footer: asleep, the frisbee beside it. Also a yard: picking the frisbee up
// wakes the wolf, and after the game it carries the frisbee back and sleeps.
export function FooterSleeper() {
  return (
    <div className="yard sleeper" data-yard="footer" data-reveal="scene" aria-hidden="true">
      <span className="yard-rest sleeper-spot">
        <span className="sleeper-z sleeper-z-a">z</span>
        <span className="sleeper-z sleeper-z-b">z</span>
        <span className="sleeper-z sleeper-z-c">z</span>
        <Px name="wolf-sleep-sm" />
      </span>
      <span className="yard-disc sleeper-disc">
        <Px name="disc" />
        <YardTip />
      </span>
      <YardWolf />
    </div>
  );
}
