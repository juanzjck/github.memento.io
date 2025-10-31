import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/ARButton.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.6);
scene.add(light);

const reticleGeometry = new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI / 2);
const reticleMaterial = new THREE.MeshBasicMaterial({
  color: 0x58a6ff,
  transparent: true,
  opacity: 0.85,
});
const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let hitTestSource = null;
let hitTestSourceRequested = false;

const controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  if (!reticle.visible) return;

  const geometry = new THREE.IcosahedronGeometry(0.05, 0);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
  });
  const mesh = new THREE.Mesh(geometry, material);
  reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  scene.add(mesh);
});
scene.add(controller);

document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.querySelector('.overlay') ?? document.body },
  }),
);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

renderer.setAnimationLoop((timestamp, frame) => {
  if (!frame) {
    renderer.render(scene, camera);
    return;
  }

  const referenceSpace = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();

  if (!hitTestSourceRequested) {
    session.requestReferenceSpace('viewer').then((viewerSpace) => {
      session
        .requestHitTestSource({ space: viewerSpace })
        .then((source) => {
          hitTestSource = source;
        })
        .catch((error) => console.warn('Hit test source failed', error));
    });

    session.addEventListener('end', () => {
      hitTestSourceRequested = false;
      hitTestSource = null;
      reticle.visible = false;
    });

    hitTestSourceRequested = true;
  }

  if (hitTestSource) {
    const hitTestResults = frame.getHitTestResults(hitTestSource);
    if (hitTestResults.length) {
      const hit = hitTestResults[0];
      reticle.visible = true;
      reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
    } else {
      reticle.visible = false;
    }
  }

  renderer.render(scene, camera);
});
