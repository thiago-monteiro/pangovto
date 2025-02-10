const _settings = {
  threshold: 0.5,
  NNVersion: 31,

  shoeRightPath: '',
  isModelLightMapped: false,
  occluderPath: 'assets/occluder.glb',

  scale: 0.95,
  translation: [0, -0.02, 0],

  debugCube: false,
  debugDisplayLandmarks: true
};

const _three = {
  loadingManager: null
};

const _states = {
  notLoaded: -1,
  loading: 0,
  running: 1,
  busy: 2
};
let _state = _states.notLoaded;

function getUUIDFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('uuid');
}

async function fetchGLBUrl(uuid) {
  try {
    const response = await fetch(`https://www.pangolito.com/api/models/${uuid}`);
    if (!response.ok) throw new Error('Failed to fetch GLB URL');

    const data = await response.json();
    return data.glbUrl;
  } catch (error) {
    console.error('Error fetching GLB URL:', error);
    return null;
  }
}

function setFullScreen(cv) {
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
}

async function main() {
  _state = _states.loading;

  const uuid = getUUIDFromURL();
  if (!uuid) {
    console.error('No UUID provided in the URL');
    return;
  }

  const glbUrl = await fetchGLBUrl(uuid);
  if (glbUrl) {
    _settings.shoeRightPath = glbUrl;
  } else {
    console.error('Failed to load GLB URL. Using fallback.');
  }

  const handTrackerCanvas = document.getElementById('handTrackerCanvas');
  const VTOCanvas = document.getElementById('ARCanvas');

  setFullScreen(handTrackerCanvas);
  setFullScreen(VTOCanvas);

  HandTrackerThreeHelper.init({
    poseLandmarksLabels: [
      'ankleBack', 'ankleOut', 'ankleIn', 'ankleFront',
      'heelBackOut', 'heelBackIn',
      'pinkyToeBaseTop', 'middleToeBaseTop', 'bigToeBaseTop'
    ],
    enableFlipObject: true,
    cameraZoom: 1,
    freeZRot: false,
    threshold: _settings.threshold,
    scanSettings: {
      multiDetectionSearchSlotsRate: 0.5,
      multiDetectionMaxOverlap: 0.3,
      multiDetectionOverlapScaleXY: [0.5, 1],
      multiDetectionEqualizeSearchSlotScale: true,
      multiDetectionForceSearchOnOtherSide: true,
      multiDetectionForceChirality: 1,
      disableIsRightHandNNEval: true,
      overlapFactors: [1.0, 1.0, 1.0],
      translationScalingFactors: [0.3, 0.3, 1],
      nScaleLevels: 2,
      scale0Factor: 0.5
    },
    VTOCanvas: VTOCanvas,
    handTrackerCanvas: handTrackerCanvas,
    debugDisplayLandmarks: false,
    NNsPaths: ['neuralNets/NN_FOOT_' + _settings.NNVersion.toString() + '.json'],
    maxHandsDetected: 2,
    stabilizationSettings: {
      NNSwitchMask: {
        isRightHand: false,
        isFlipped: false
      }
    },
    landmarksStabilizerSpec: {
      minCutOff: 0.001,
      beta: 5
    }
  }).then(function (three) {
    handTrackerCanvas.style.zIndex = 3;
    start(three);
  }).catch(function (err) {
    console.log('INFO in main.js: an error happens ', err);
  });
}

function hide_loading() {
  const domLoading = document.getElementById('loading');
  domLoading.style.opacity = 0;
  setTimeout(function () {
    domLoading.parentNode.removeChild(domLoading);
  }, 800);
}

function start(three) {
  three.loadingManager.onLoad = function () {
    console.log('INFO in main.js: Everything is loaded');
    hide_loading();
    _state = _states.running;
  };

  three.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  three.renderer.outputEncoding = THREE.sRGBEncoding;

  if (!_settings.isModelLightMapped) {
    const pointLight = new THREE.PointLight(0xffffff, 2);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    three.scene.add(pointLight, ambientLight);
  }

  if (_settings.debugCube) {
    const s = 1;
    const cubeGeom = new THREE.BoxGeometry(s, s, s);
    const cubeMesh = new THREE.Mesh(cubeGeom, new THREE.MeshNormalMaterial());
    HandTrackerThreeHelper.add_threeObject(cubeMesh);
  }

  function transform(threeObject) {
    threeObject.scale.multiplyScalar(_settings.scale);
    threeObject.position.add(new THREE.Vector3().fromArray(_settings.translation));
  }

  new THREE.GLTFLoader().load(_settings.shoeRightPath, function (gltf) {
    const shoe = gltf.scene;
    transform(shoe);
    HandTrackerThreeHelper.add_threeObject(shoe);
  });

  new THREE.GLTFLoader(three.loadingManager).load(_settings.occluderPath, function (gltf) {
    const occluder = gltf.scene.children[0];
    transform(occluder);
    HandTrackerThreeHelper.add_threeOccluder(occluder);
  });
}

window.addEventListener('load', main);
