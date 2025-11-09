// Core imports
// - three: main 3D library
// - OrbitControls: user camera controls (mouse/touch)
// - GLTFLoader: loads .glb / .gltf model files
// - Octree, Capsule: helper math/physics utilities from three/examples
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";

// Audio with Howler.js
// `sounds` stores Howl objects for playback of background music and SFX
const sounds = {
  backgroundMusic: new Howl({
    src: ["./sfx/music.ogg"],
    loop: true,
    volume: 0.3,
    preload: true,
  }),

  projectsSFX: new Howl({
    src: ["./sfx/projects.ogg"],
    volume: 0.5,
    preload: true,
  }),

  pokemonSFX: new Howl({
    src: ["./sfx/pokemon.ogg"],
    volume: 0.5,
    preload: true,
  }),

  jumpSFX: new Howl({
    src: ["./sfx/jumpsfx.ogg"],
    volume: 1.0,
    preload: true,
  }),
};

// Notes on audio:
// - Howl instances begin loading when created (preload: true).
// - Browsers often block autoplay; playback is invoked after a user gesture
//   (see the enterButton click handler later which starts background music).
// - `isMuted` controls whether playSound actually calls Howl.play().

// Input flags
let touchHappened = false; // true when a touch interaction has occurred (used to prevent double handling)

// Audio mute state
let isMuted = false; // toggle to silence audio

function playSound(soundId) {
  if (!isMuted && sounds[soundId]) {
    sounds[soundId].play();
  }
}

function stopSound(soundId) {
  if (sounds[soundId]) {
    sounds[soundId].stop();
  }
}

// Small helpers to guard audio playback; keep calls centralized so mute
// behavior is easy to enforce and change in one place.

// three.js setup
// Create the main scene and set a background color
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaec972);
// Get the canvas element from the HTML where we'll render the scene
const canvas = document.getElementById("experience-canvas");
// Track current viewport sizes for camera/renderer updates
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Physics configuration and runtime state
// Constants used for player physics simulation
const GRAVITY = 30; // gravitational acceleration applied when in air
const CAPSULE_RADIUS = 0.35; // collision capsule radius
const CAPSULE_HEIGHT = 1; // collision capsule height
const JUMP_HEIGHT = 11; // initial upward velocity when jumping
const MOVE_SPEED = 7; // horizontal movement speed

// Character runtime state
let character = {
  instance: null, // the Object3D used for character position/rotation
  isMoving: false,
  spawnPosition: new THREE.Vector3(),
};
let targetRotation = Math.PI / 2; // desired yaw orientation

// Collision structure: octree for environment, capsule for player
const colliderOctree = new Octree();
const playerCollider = new Capsule(
  new THREE.Vector3(0, CAPSULE_RADIUS, 0),
  new THREE.Vector3(0, CAPSULE_HEIGHT, 0),
  CAPSULE_RADIUS
);

// Player physics state
let playerVelocity = new THREE.Vector3();
let playerOnFloor = false; // set true when collision normal indicates floor contact

// Renderer configuration
// Create WebGL renderer bound to the canvas element and enable antialiasing
// Tone mapping and shadow map settings improve final image quality
// See threejs docs for renderer options
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

// Set renderer viewport and pixel ratio to look sharp on high-DPI displays
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Shadow map configuration
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;
// Optional filmic tone mapping for nicer colors
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.7;

// Some of our DOM elements, others are scattered in the file
let isModalOpen = false;
const modal = document.querySelector(".modal");
const modalbgOverlay = document.querySelector(".modal-bg-overlay");
const modalTitle = document.querySelector(".modal-title");
const modalProjectDescription = document.querySelector(
  ".modal-project-description"
);
const modalExitButton = document.querySelector(".modal-exit-button");
const modalVisitProjectButton = document.querySelector(
  ".modal-project-visit-button"
);
const themeToggleButton = document.querySelector(".theme-mode-toggle-button");
const firstIcon = document.querySelector(".first-icon");
const secondIcon = document.querySelector(".second-icon");

const audioToggleButton = document.querySelector(".audio-toggle-button");
const firstIconTwo = document.querySelector(".first-icon-two");
const secondIconTwo = document.querySelector(".second-icon-two");

// Modal stuff
const modalContent = {
  Project_1: {
    title: "My Portfolio",
    content:
      "This portfolio was created using React. The inspiration for the theme was based on 80's retro arcade games. The site is mobile and desktop responsive, with additional functionality including an app-wide music player that is saved in the app state.",
    link: "https://shubbu-portfolio.netlify.app/?",
  },
  Project_2: {
    title: "Moviesflix",
    content:
      "Flixer is a clone of Netflix's web interface. This app was created using React functional components, Redux state management, axios async/await requests, and deployed on Google Firebase. Firebase Authentication allows user account creation, and Firebase Firestore is the database used to store customer and product records. Additional functionality includes customer subscription checkout powered by the Stripe Firebase Extension and Stripe API integration. Once a user is subscribed, movie data is pulled from The Movie Database (TMDB) for trending movies and movie poster images. Movie trailers are integrated from YouTube if one is successfully found.",
    link: "https://flix-97e6f.web.app/profile",
  },
  Project_3: {
    title: "Google Docs Clone",
    content:
      "GOOGLE DOCS Clone made using Next.js, Rich Text Editor, Tailwind CSS & Firebase. GOOGLE DOCS build using functionality like NextAuth,Firebase,Rich Text Editor:RichTextEditor is the main editor component. It is comprised of the Draft.js <Editor>, some UI components (e.g. toolbar) and some helpful abstractions around getting and setting content with HTML/Markdown. RichTextEditor is designed to be used like a textarea except that instead of value being a string, it is an object with toString on it. Creating a value from a string is also easy using createValueFromString(markup, 'html')",
    link: "https://google-docs-beta.vercel.app/",
  },
  Picnic: {
    title: "🍷 Uggh yesss 🧺",
    content:
      " Picnics are my thanggg don't @ me. Lying down with some good grape juice inna wine glass and a nice book at a park is my total vibe. If this isn't max aura points 💯 idk what is.",
  },
  Chest: {
    title: "Treasure Chest",
    content: "Yarr! Ye found me treasure chest! But alas, it's empty. The real treasure be the friends we made along the way!",
  }
};

function showModal(id) {
  const content = modalContent[id];
  if (content) {
    modalTitle.textContent = content.title;
    modalProjectDescription.textContent = content.content;

    if (content.link) {
      modalVisitProjectButton.href = content.link;
      modalVisitProjectButton.classList.remove("hidden");
    } else {
      modalVisitProjectButton.classList.add("hidden");
    }
    modal.classList.remove("hidden");
    modalbgOverlay.classList.remove("hidden");
    isModalOpen = true;
  }
}

function hideModal() {
  isModalOpen = false;
  modal.classList.add("hidden");
  modalbgOverlay.classList.add("hidden");
  if (!isMuted) {
    playSound("projectsSFX");
  }
}

// Our Intersecting objects
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let intersectObject = "";
const intersectObjects = [];
const intersectObjectsNames = [
  "Project_1",
  "Project_2",
  "Project_3",
  "Picnic",
  "Squirtle",
  "Chicken",
  "Pikachu",
  "Bulbasaur",
  "Charmander",
  "Snorlax",
  "Chest",
];

// Loading screen and loading manager
// See: https://threejs.org/docs/#api/en/loaders/managers/LoadingManager
const loadingScreen = document.getElementById("loadingScreen");
const loadingText = document.querySelector(".loading-text");
const enterButton = document.querySelector(".enter-button");
const instructions = document.querySelector(".instructions");

const manager = new THREE.LoadingManager();

manager.onLoad = function () {
  const t1 = gsap.timeline();

  t1.to(loadingText, {
    opacity: 0,
    duration: 0,
  });

  t1.to(enterButton, {
    opacity: 1,
    duration: 0,
  });
};

enterButton.addEventListener("click", () => {
  gsap.to(loadingScreen, {
    opacity: 0,
    duration: 0,
  });
  gsap.to(instructions, {
    opacity: 0,
    duration: 0,
    onComplete: () => {
      loadingScreen.remove();
    },
  });

  if (!isMuted) {
    playSound("projectsSFX");
    playSound("backgroundMusic");
  }
});

//Audio

// GLTF Loader
// See: https://threejs.org/docs/?q=glt#examples/en/loaders/GLTFLoader
const loader = new GLTFLoader(manager);

loader.load(
  "./park.glb",
  function (glb) {
    // Traverse all nodes in the loaded GLTF scene. We use traversal to:
    //  - collect interactive nodes (names listed in intersectObjectsNames)
    //  - enable shadows on meshes
    //  - detect the special 'Character' mesh and set up its pivot & collider
    glb.scene.traverse((child) => {
      // If this child's name is in the list of interactive names, add it
      // to the array used by the raycaster.
      if (intersectObjectsNames.includes(child.name)) {
        intersectObjects.push(child);
      }

      // Log each traversed node for debugging so you can see the model
      // hierarchy in the browser console.
      console.log(child.name);

      // If the node is a renderable mesh, enable shadow casting/receiving.
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }

      // Special-case: when we find the 'Character' mesh we create a pivot
      // object to act as the logical character root. The visual mesh is
      // reparented under the pivot so yaw rotations apply to the pivot
      // while the visual child can keep its X rotation (so it doesn't look
      // down when we yaw).
      if (child.name === "Character" || child.name === "character") {
        console.log("Found Character");
        const pivot = new THREE.Object3D();
        pivot.position.copy(child.position);
        scene.add(pivot);
        pivot.add(child);
        // Reset visual mesh local transform so it's positioned relative to
        // the pivot (pivot is the true world-space reference).
        child.position.set(0, 0, 0);

        // Normalize visual orientation (convert degrees to radians).
        child.rotation.x = 90 * (Math.PI / 180);
        child.rotation.z = 0;
        child.updateMatrixWorld(true);

        // Store references used by the movement and respawn logic.
        character.spawnPosition.copy(pivot.position);
        character.instance = pivot; // movement rotates this pivot
        character.visual = child; // visual mesh for cosmetic tweaks

        // Align the physics capsule with the pivot's world position so
        // collisions match the visible character.
        playerCollider.start
          .copy(pivot.position)
          .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
        playerCollider.end
          .copy(pivot.position)
          .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));
      }

      // Build the collision octree from the 'Ground_Collider' mesh and hide
      // the collider geometry so it doesn't render but is available for
      // collision queries.
      if (child.name === "Ground_Collider") {
        colliderOctree.fromGraphNode(child);
        child.visible = false;
      }
    });
    scene.add(glb.scene);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

// Lighting and Enviornment Stuff
// See: https://threejs.org/docs/?q=light#api/en/lights/DirectionalLight
// See: https://threejs.org/docs/?q=light#api/en/lights/AmbientLight
const sun = new THREE.DirectionalLight(0xffffff);
sun.castShadow = true;
sun.position.set(280, 200, -80);
sun.target.position.set(100, 0, -10);
sun.shadow.mapSize.width = 4096;
sun.shadow.mapSize.height = 4096;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -100;
sun.shadow.normalBias = 0.2;
scene.add(sun.target);
scene.add(sun);

// const shadowCameraHelper = new THREE.CameraHelper(sun.shadow.camera);
// scene.add(shadowCameraHelper);

// const sunHelper = new THREE.CameraHelper(sun);
// scene.add(sunHelper);

const light = new THREE.AmbientLight(0x404040, 2.7);
scene.add(light);

// Note about lighting:
// - Directional light 'sun' provides sharp, directional shadows like sunlight.
// - Shadow map resolution is set high; if you experience performance issues
//   consider reducing mapSize to 1024 or 2048.
// - normalBias helps with shadow acne but may produce small shadow detachment
//   if too large. Tweak per-model if you see artifacts.

// Camera setup
// Math summary (orthographic frustum):
// - aspect = width / height
// - halfHeight = 50 (world units)
// - left = -aspect * halfHeight, right = aspect * halfHeight
// - top = halfHeight, bottom = -halfHeight
// These values define an orthographic projection box (no perspective
// foreshortening). Near/far define the visible depth range in world units.
// We later use camera.zoom to scale the visible area. Call updateProjectionMatrix()
// after changing frustum or zoom so the camera's projection matrix is recomputed.
// We keep a `cameraOffset` vector to compute a follow-camera position relative
// to the character each frame.
// We treat 1 world unit as the base unit for physics and geometry; tuning
// constants (gravity, jump, speeds) are in these world units.
const aspect = sizes.width / sizes.height;
const camera = new THREE.OrthographicCamera(
  -aspect * 50,
  aspect * 50,
  50,
  -50,
  1,
  1000
);

// Position the camera above and behind the scene center. We keep a
// cameraOffset vector so the follow-camera math in the animation loop
// can compute the camera's target relative to the character.
camera.position.x = -13;
camera.position.y = 39;
camera.position.z = -67;

const cameraOffset = new THREE.Vector3(-13, 39, -67);

// Zoom controls how large objects appear; updateProjectionMatrix() must be
// called after changing frustum or zoom values to apply them.
camera.zoom = 2.2;
camera.updateProjectionMatrix();

// OrbitControls are handy for debugging and camera inspection. We update
// them once here — they're left enabled so you can rotate/zoom with mouse.
const controls = new OrbitControls(camera, canvas);
controls.update();

// Handle when window resizes
function onResize() {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  const aspect = sizes.width / sizes.height;
  camera.left = -aspect * 50;
  camera.right = aspect * 50;
  camera.top = 50;
  camera.bottom = -50;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Interact with Objects and Raycaster
// See: https://threejs.org/docs/?q=raycas#api/en/core/Raycaster
let isCharacterReady = true;

// Jump animation for side characters like pickachu, bulbasaur, etc.
function jumpCharacter(meshID) {
  if (!isCharacterReady) return;

  const mesh = scene.getObjectByName(meshID);
  const jumpHeight = 2;
  const jumpDuration = 0.5;
  const isSnorlax = meshID === "Snorlax";

  const currentScale = {
    x: mesh.scale.x,
    y: mesh.scale.y,
    z: mesh.scale.z,
  };

  const t1 = gsap.timeline();

  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 1.2 : 1.2,
    y: isSnorlax ? currentScale.y * 0.8 : 0.8,
    z: isSnorlax ? currentScale.z * 1.2 : 1.2,
    duration: jumpDuration * 0.2,
    ease: "power2.out",
  });

  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 0.8 : 0.8,
    y: isSnorlax ? currentScale.y * 1.3 : 1.3,
    z: isSnorlax ? currentScale.z * 0.8 : 0.8,
    duration: jumpDuration * 0.3,
    ease: "power2.out",
  });

  t1.to(
    mesh.position,
    {
      y: mesh.position.y + jumpHeight,
      duration: jumpDuration * 0.5,
      ease: "power2.out",
    },
    "<"
  );

  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 1.2 : 1,
    y: isSnorlax ? currentScale.y * 1.2 : 1,
    z: isSnorlax ? currentScale.z * 1.2 : 1,
    duration: jumpDuration * 0.3,
    ease: "power1.inOut",
  });

  t1.to(
    mesh.position,
    {
      y: mesh.position.y,
      duration: jumpDuration * 0.5,
      ease: "bounce.out",
      onComplete: () => {
        isCharacterReady = true;
      },
    },
    ">"
  );

  if (!isSnorlax) {
    t1.to(mesh.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: jumpDuration * 0.2,
      ease: "elastic.out(1, 0.3)",
    });
  }
}

function onClick() {
  if (touchHappened) return;
  handleInteraction();
}

function handleInteraction() {
  if (!modal.classList.contains("hidden")) {
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(intersectObjects);

  if (intersects.length > 0) {
    intersectObject = intersects[0].object.parent.name;
  } else {
    intersectObject = "";
  }

  if (intersectObject !== "") {
    if (
      [
        "Bulbasaur",
        "Chicken",
        "Pikachu",
        "Charmander",
        "Squirtle",
        "Snorlax",
      ].includes(intersectObject)
    ) {
      if (isCharacterReady) {
        if (!isMuted) {
          playSound("pokemonSFX");
        }
        jumpCharacter(intersectObject);
        isCharacterReady = false;
      }
    } else {
      if (intersectObject) {
        showModal(intersectObject);
        if (!isMuted) {
          playSound("projectsSFX");
        }
      }
    }
  }
}

function onMouseMove(event) {
  // Map DOM pixel coordinates to Normalized Device Coordinates (NDC):
  // NDC X = (clientX / width) * 2 - 1 -> maps [0,width] to [-1,1]
  // NDC Y = -(clientY / height) * 2 + 1 -> maps [0,height] to [1,-1]
  // The Y is negated because DOM Y grows downward while NDC Y grows upward.
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  touchHappened = false;
}

function onTouchEnd(event) {
  // Touch events don't always expose clientX/clientY directly; prefer
  // changedTouches for robust values. If changedTouches is not present
  // fall back to event.clientX/clientY for pointer event compatibility.
  const x = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
  const y = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

  pointer.x = (x / window.innerWidth) * 2 - 1;
  pointer.y = -(y / window.innerHeight) * 2 + 1;

  touchHappened = true;
  handleInteraction();
}

// Movement and Gameplay functions
function respawnCharacter() {
  character.instance.position.copy(character.spawnPosition);

  playerCollider.start
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
  playerCollider.end
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));

  playerVelocity.set(0, 0, 0);
  character.isMoving = false;
}

function playerCollisions() {
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false;

  if (result) {
    playerOnFloor = result.normal.y > 0;
    playerCollider.translate(result.normal.multiplyScalar(result.depth));

    if (playerOnFloor) {
      character.isMoving = false;
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

// capsuleIntersect returns info about penetration depth and normal. We
// resolve penetration by translating the capsule out of geometry along the
// collision normal. This keeps the player from sinking into the world.

function updatePlayer() {
  if (!character.instance) return;

  // Math summary (integration):
  // - We use semi-explicit Euler integration with a fixed timestep proxy dt
  //   (0.035). If v is velocity and a is acceleration (gravity), then:
  //     v += a * dt
  //     x += v * dt
  // - Here GRAVITY is treated as acceleration in world-units/sec^2; dt is
  //   the scalar 0.035 used throughout. For stable physics across variable
  //   frame rates prefer computing a real dt from timestamps instead.

  if (character.instance.position.y < -20) {
    respawnCharacter();
    return;
  }

  // Integrate gravity when player is airborne. The magic scalar 0.035 is
  // a fixed timestep proxy; for more stable physics across variable frame
  // rates consider measuring deltaTime in the animation loop and using
  // that instead.
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * 0.035;
  }

  // Translate the capsule by velocity scaled by timestep.
  playerCollider.translate(playerVelocity.clone().multiplyScalar(0.035));

  playerCollisions();

  character.instance.position.copy(playerCollider.start);
  character.instance.position.y -= CAPSULE_RADIUS;

  // Math summary (angle wrapping):
  // - We need the minimal signed angular difference between targetRotation
  //   and the current rotation (in radians). Angles wrap every 2*PI, so a
  //   naive subtraction may produce values outside [-PI, PI]. The expression
  //   below wraps the difference into (-PI, PI] which represents the shortest
  //   rotation direction and magnitude.
  let rotationDiff =
    ((((targetRotation - character.instance.rotation.y) % (2 * Math.PI)) +
      3 * Math.PI) %
      (2 * Math.PI)) -
    Math.PI;
  let finalRotation = character.instance.rotation.y + rotationDiff;
  // Smoothly interpolate the yaw (Y rotation) toward the targetRotation.
  // The wrapping math above ensures the shortest rotation path across
  // the -PI..PI boundary. Lerp factor 0.4 gives a soft, eased rotation.
  character.instance.rotation.y = THREE.MathUtils.lerp(
    character.instance.rotation.y,
    finalRotation,
    0.4
  );
  // If we wrapped the visual mesh in a pivot, keep the visual child's X/Z
  // rotation fixed and enforce uniform scale on the visual mesh only.
  if (character.visual) {
    character.visual.rotation.x = 90 * (Math.PI / 180);
    character.visual.rotation.z = 0;
    // character.visual.scale.set(1, 1, 1);
  } else {
    // Fallback: if no visual child stored, keep instance upright on X/Z
    character.instance.rotation.x = 90 * (Math.PI / 180);
    character.instance.rotation.z = 0;
  }
}

function onKeyDown(event) {
  if (event.code.toLowerCase() === "keyr") {
    respawnCharacter();
    return;
  }

  switch (event.code.toLowerCase()) {
    case "keyw":
    case "arrowup":
      pressedButtons.up = true;
      break;
    case "keys":
    case "arrowdown":
      pressedButtons.down = true;
      break;
    case "keya":
    case "arrowleft":
      pressedButtons.left = true;
      break;
    case "keyd":
    case "arrowright":
      pressedButtons.right = true;
      break;
  }
}

function onKeyUp(event) {
  switch (event.code.toLowerCase()) {
    case "keyw":
    case "arrowup":
      pressedButtons.up = false;
      break;
    case "keys":
    case "arrowdown":
      pressedButtons.down = false;
      break;
    case "keya":
    case "arrowleft":
      pressedButtons.left = false;
      break;
    case "keyd":
    case "arrowright":
      pressedButtons.right = false;
      break;
  }
}

// Toggle Theme Function
function toggleTheme() {
  if (!isMuted) {
    playSound("projectsSFX");
  }
  const isDarkTheme = document.body.classList.contains("dark-theme");
  document.body.classList.toggle("dark-theme");
  document.body.classList.toggle("light-theme");

  if (firstIcon.style.display === "none") {
    firstIcon.style.display = "block";
    secondIcon.style.display = "none";
  } else {
    firstIcon.style.display = "none";
    secondIcon.style.display = "block";
  }

  gsap.to(light.color, {
    r: isDarkTheme ? 1.0 : 0.25,
    g: isDarkTheme ? 1.0 : 0.31,
    b: isDarkTheme ? 1.0 : 0.78,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(light, {
    intensity: isDarkTheme ? 0.8 : 0.9,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(sun, {
    intensity: isDarkTheme ? 1 : 0.8,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(sun.color, {
    r: isDarkTheme ? 1.0 : 0.25,
    g: isDarkTheme ? 1.0 : 0.41,
    b: isDarkTheme ? 1.0 : 0.88,
    duration: 1,
    ease: "power2.inOut",
  });
}

// Toggle Audio Function
function toggleAudio() {
  if (!isMuted) {
    playSound("projectsSFX");
  }
  if (firstIconTwo.style.display === "none") {
    firstIconTwo.style.display = "block";
    secondIconTwo.style.display = "none";
    isMuted = false;
    sounds.backgroundMusic.play();
  } else {
    firstIconTwo.style.display = "none";
    secondIconTwo.style.display = "block";
    isMuted = true;
    sounds.backgroundMusic.pause();
  }
}

// Mobile controls
const mobileControls = {
  up: document.querySelector(".mobile-control.up-arrow"),
  left: document.querySelector(".mobile-control.left-arrow"),
  right: document.querySelector(".mobile-control.right-arrow"),
  down: document.querySelector(".mobile-control.down-arrow"),
};

const pressedButtons = {
  up: false,
  left: false,
  right: false,
  down: false,
};

function handleJumpAnimation() {
  if (!character.instance || !character.isMoving) return;

  const jumpDuration = 0.5;
  const jumpHeight = 2;

  const t1 = gsap.timeline();

  t1.to(character.instance.scale, {
    duration: jumpDuration * 0.2,
    ease: "power2.out",
  });

  t1.to(character.instance.scale, {
    duration: jumpDuration * 0.3,
    ease: "power2.out",
  });

  t1.to(character.instance.scale, {
    duration: jumpDuration * 0.3,
    ease: "power1.inOut",
  });

  t1.to(character.instance.scale, {
    duration: jumpDuration * 0.2,
  });
}

function handleContinuousMovement() {
  if (!character.instance) return;

  if (
    Object.values(pressedButtons).some((pressed) => pressed) &&
    !character.isMoving
  ) {
    if (!isMuted) {
      playSound("jumpSFX");
    }
    if (pressedButtons.up) {
      playerVelocity.z += MOVE_SPEED;
      targetRotation = 0;
    }
    if (pressedButtons.down) {
      playerVelocity.z -= MOVE_SPEED;
      targetRotation = -Math.PI;
    }
    if (pressedButtons.left) {
      playerVelocity.x += MOVE_SPEED;
      targetRotation = Math.PI / 2;
    }
    if (pressedButtons.right) {
      playerVelocity.x -= MOVE_SPEED;
      targetRotation = -Math.PI / 2;
    }

    playerVelocity.y = JUMP_HEIGHT;
    character.isMoving = true;
    handleJumpAnimation();
  }
}

// Notes on movement:
// - Movement applies an impulse to playerVelocity and sets a short
//   jump impulse so the character visibly hops when starting to move.
// - `character.isMoving` prevents repeated impulses until collisions
//   or other logic reset the state.

Object.entries(mobileControls).forEach(([direction, element]) => {
  // Bind both touch and mouse events so the controls work on mobile and desktop
  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    pressedButtons[direction] = true;
  });

  element.addEventListener("touchend", (e) => {
    e.preventDefault();
    pressedButtons[direction] = false;
  });

  element.addEventListener("mousedown", (e) => {
    e.preventDefault();
    pressedButtons[direction] = true;
  });

  element.addEventListener("mouseup", (e) => {
    e.preventDefault();
    pressedButtons[direction] = false;
  });

  element.addEventListener("mouseleave", (e) => {
    pressedButtons[direction] = false;
  });

  element.addEventListener("touchcancel", (e) => {
    pressedButtons[direction] = false;
  });
});

window.addEventListener("blur", () => {
  Object.keys(pressedButtons).forEach((key) => {
    pressedButtons[key] = false;
  });
});

// Adding Event Listeners (tbh could make some of these just themselves rather than seperating them, oh well)
modalExitButton.addEventListener("click", hideModal);
modalbgOverlay.addEventListener("click", hideModal);
themeToggleButton.addEventListener("click", toggleTheme);
audioToggleButton.addEventListener("click", toggleAudio);
window.addEventListener("resize", onResize);
window.addEventListener("click", onClick, { passive: false });
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("touchend", onTouchEnd, { passive: false });
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// Like our movie strip!!! Calls on each frame.
function animate() {
  updatePlayer();
  handleContinuousMovement();

  if (character.instance) {
    const targetCameraPosition = new THREE.Vector3(
      character.instance.position.x + cameraOffset.x - 20,
      cameraOffset.y,
      character.instance.position.z + cameraOffset.z + 30
    );
    camera.position.copy(targetCameraPosition);
    camera.lookAt(
      character.instance.position.x + 10,
      camera.position.y - 39,
      character.instance.position.z + 10
    );
  }

  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(intersectObjects);

  if (intersects.length > 0) {
    document.body.style.cursor = "pointer";
  } else {
    document.body.style.cursor = "default";
    intersectObject = "";
  }

  // If there are intersections, prefer the first hit. The loop below was
  // redundant (always reading index 0) so we explicitly choose the first
  // intersected object's parent name when available.
  if (intersects.length > 0) {
    intersectObject = intersects[0].object.parent.name;
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
