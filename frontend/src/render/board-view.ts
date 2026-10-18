import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FallingBlock } from '../game/board';
import type { Game } from '../game/game';
import type { Cell, PieceType } from '../game/pieces';
import type { Theme } from './themes';

const FOV = 40;
const BLOCK = 0.9;

/** Look of the Matrix-style camera orbit. Tweak these to taste. */
const BULLET_TIME = {
  /** How high the camera rises during the orbit. */
  lift: 7,
  /** Dutch-angle roll at the middle of the orbit, in degrees. */
  rollDeg: 14,
  /** Closer to 1 leaves longer ghost trails behind moving blocks. */
  trail: 0.82,
};

// Slow start, very fast sweep, slow end: the 'frozen moment' feel.
const easeInOutQuint = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeIn = (t: number) => t * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

interface Animation {
  elapsed: number;
  duration: number;
}

interface CameraTurn extends Animation {
  from: number;
  to: number;
}

interface FlipAnimation extends Animation {
  falls: FallingBlock[];
}

/** Draws the board, the pieces and the camera effects with Three.js. */
export class BoardView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly trail: AfterimagePass;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly board = new THREE.Group();
  private readonly blocks: THREE.InstancedMesh;
  private readonly ghost: THREE.InstancedMesh;
  private readonly blockMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.35,
    metalness: 0.1,
  });
  private readonly tileTexture = createTileTexture();
  private readonly frameMaterial = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  private readonly gridMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 });
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly frameTarget = new THREE.Color();
  private theme: Theme;
  /** The landing preview is off by default: it makes the game easier. */
  showGhost = false;

  private azimuth = 0;
  private wasSpinning = false;
  private distance = 30;
  private cameraTurn: CameraTurn | null = null;
  private flip: FlipAnimation | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly width: number,
    private readonly height: number,
    theme: Theme,
  ) {
    this.theme = theme;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(6, 14, 18);
    this.scene.add(sun);
    // A second light behind the board so it still looks good when the camera is back there.
    const backLight = new THREE.DirectionalLight(0xffffff, 1.2);
    backLight.position.set(-6, 10, -18);
    this.scene.add(backLight);

    const cells = width * height;
    const geometry = new RoundedBoxGeometry(BLOCK, BLOCK, BLOCK, 2, 0.12);
    this.blocks = new THREE.InstancedMesh(geometry, this.blockMaterial, cells + 4);
    this.ghost = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }),
      4,
    );
    this.board.add(this.blocks, this.ghost, this.buildFrame(), this.buildGrid());
    this.scene.add(this.board);

    // Post-processing is only used during the orbit, to leave motion trails.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.trail = new AfterimagePass(BULLET_TIME.trail);
    this.composer.addPass(this.trail);
    this.composer.addPass(new OutputPass());

    this.setTheme(theme);
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.scene.background = new THREE.Color(theme.background);
    this.frameMaterial.color.set(this.frameColor(theme));
    this.gridMaterial.color.set(theme.gridLines);
    // Only the Game Boy theme gets the retro inset-square tile pattern.
    this.blockMaterial.map = theme.id === 'gameboy' ? this.tileTexture : null;
    this.blockMaterial.needsUpdate = true;
  }

  /** Blue frame in front of the board, red when the camera is behind it. */
  private frameColor(theme: Theme): string {
    return Math.cos(this.azimuth) < 0 ? theme.frameBehind : theme.frame;
  }

  /** Starts the "bullet time" orbit: the camera travels half way around the board. */
  turnCamera(direction: 1 | -1, duration: number): void {
    this.cameraTurn = {
      from: this.azimuth,
      to: this.azimuth + direction * Math.PI,
      elapsed: 0,
      duration,
    };
  }

  /** Starts the hourglass animation: the board rotates, then blocks fall. */
  playFlip(falls: FallingBlock[], duration: number): void {
    this.flip = { falls, elapsed: 0, duration };
  }

  resetCamera(): void {
    this.azimuth = 0;
    this.wasSpinning = false;
    this.cameraTurn = null;
    this.flip = null;
  }

  render(game: Game, dt: number): void {
    this.animateCamera(dt, game);
    let count = 0;

    if (this.flip && game.phase === 'flipping') {
      count = this.drawFlip(dt);
    } else {
      this.flip = null;
      this.board.rotation.x = 0;
      game.grid.forEach((row, y) =>
        row.forEach((type, x) => {
          if (type) this.setBlock(this.blocks, count++, x, y, type);
        }),
      );
      const active = game.active;
      if (active) {
        for (const cell of game.activeCells())
          this.setBlock(this.blocks, count++, cell.x, cell.y, active.type);
      }
    }
    this.blocks.count = count;
    this.drawGhost(this.showGhost ? game.active?.type : undefined, game.ghostCells());

    if (this.cameraTurn) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private drawGhost(type: PieceType | undefined, cells: Cell[]): void {
    this.ghost.count = type ? cells.length : 0;
    if (!type) return;
    cells.forEach((cell, i) => this.setBlock(this.ghost, i, cell.x, cell.y, type));
  }

  private drawFlip(dt: number): number {
    const flip = this.flip!;
    flip.elapsed += dt;
    const t = clamp01(flip.elapsed / flip.duration);
    const turnEnd = 0.45;
    let count = 0;

    if (t < turnEnd) {
      // The board turns over around its horizontal axis, blocks keep their old place.
      this.board.rotation.x = Math.PI * easeInOut(t / turnEnd);
      for (const fall of flip.falls) {
        this.setBlock(this.blocks, count++, fall.col, this.height - 1 - fall.fromRow, fall.type);
      }
    } else {
      // Upside down: blocks fall like sand in an hourglass.
      this.board.rotation.x = 0;
      const progress = easeIn(clamp01((t - turnEnd) / (1 - turnEnd - 0.1)));
      for (const fall of flip.falls) {
        const row = fall.fromRow + (fall.toRow - fall.fromRow) * progress;
        this.setBlock(this.blocks, count++, fall.col, row, fall.type);
      }
    }
    return count;
  }

  private animateCamera(dt: number, game: Game): void {
    let lift = 0;
    let roll = 0;
    if (game.spinning) {
      // Spinning: the game owns the angle and the camera simply follows it.
      this.cameraTurn = null;
      this.azimuth = game.cameraAngle;
      this.wasSpinning = true;
    } else if (this.wasSpinning) {
      // The spin ended in front of the board, after a whole number of turns.
      this.wasSpinning = false;
      this.azimuth = 0;
    } else if (this.cameraTurn) {
      const turn = this.cameraTurn;
      turn.elapsed += dt;
      const t = clamp01(turn.elapsed / turn.duration);
      this.azimuth = turn.from + (turn.to - turn.from) * easeInOutQuint(t);
      // Everything peaks at the middle of the orbit, like the Matrix bullet-time shot.
      const push = Math.sin(Math.PI * t);
      lift = push * BULLET_TIME.lift;
      roll = push * THREE.MathUtils.degToRad(BULLET_TIME.rollDeg);
      if (t >= 1) this.cameraTurn = null;
    }
    // The frame turns red while the camera is behind the board.
    // The fade takes the same time on every refresh rate (about a tenth of a second).
    this.frameMaterial.color.lerp(
      this.frameTarget.set(this.frameColor(this.theme)),
      1 - Math.exp(-dt / 40),
    );
    // While spinning the camera backs off a little when it sees the board edge-on, so the
    // near wall never grows out of the screen.
    const sideBackOff = game.spinning ? 1 + 0.3 * Math.abs(Math.sin(this.azimuth)) : 1;
    const d = this.distance * sideBackOff;
    this.camera.position.set(Math.sin(this.azimuth) * d, 1.5 + lift, Math.cos(this.azimuth) * d);
    this.camera.lookAt(0, 0, 0);
    this.camera.rotateZ(roll);
  }

  private setBlock(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    row: number,
    type: PieceType,
  ) {
    this.matrix.setPosition(x - this.width / 2 + 0.5, this.height / 2 - row - 0.5, 0);
    mesh.setMatrixAt(index, this.matrix);
    mesh.setColorAt(index, this.color.set(this.theme.pieces[type]));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private buildFrame(): THREE.Group {
    const frame = new THREE.Group();
    const w = this.width;
    const h = this.height;
    const wall = new THREE.BoxGeometry(0.4, h + 0.8, 1.2);
    const left = new THREE.Mesh(wall, this.frameMaterial);
    left.position.set(-w / 2 - 0.2, 0, 0);
    const right = left.clone();
    right.position.x = w / 2 + 0.2;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.4, 1.2), this.frameMaterial);
    floor.position.set(0, -h / 2 - 0.2, 0);
    const top = floor.clone();
    top.position.y = h / 2 + 0.2;
    frame.add(left, right, floor, top);
    return frame;
  }

  /** Thin lines on the back plane, visible from both sides of the board. */
  private buildGrid(): THREE.LineSegments {
    const points: number[] = [];
    const w = this.width;
    const h = this.height;
    const z = -BLOCK / 2;
    for (let x = 0; x <= w; x++) points.push(x - w / 2, -h / 2, z, x - w / 2, h / 2, z);
    for (let y = 0; y <= h; y++) points.push(-w / 2, y - h / 2, z, w / 2, y - h / 2, z);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return new THREE.LineSegments(geometry, this.gridMaterial);
  }

  /** Called after every resize, so the page can line its panels up with the board frame. */
  onResize: (() => void) | null = null;

  /**
   * Where the board frame sits in the canvas, in CSS pixels, seen from the front (the resting
   * camera). The page uses it to align the side panel and the Next/Hold boxes with the frame.
   */
  frameRect(): { top: number; bottom: number; left: number; right: number } {
    const { clientWidth: w, clientHeight: h } = this.container;
    const camera = new THREE.PerspectiveCamera(FOV, w / Math.max(h, 1), 0.1, 200);
    camera.position.set(0, 1.5, this.distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const halfW = this.width / 2 + 0.4;
    const halfH = this.height / 2 + 0.4;
    const project = (x: number, y: number) => {
      const p = new THREE.Vector3(x, y, 0.6).project(camera);
      return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
    };
    const topLeft = project(-halfW, halfH);
    const bottomRight = project(halfW, -halfH);
    return { top: topLeft.y, bottom: bottomRight.y, left: topLeft.x, right: bottomRight.x };
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Keep the whole board in view, whatever the screen shape.
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const fitHeight = (this.height / 2 + 1.5) / tan;
    const fitWidth = (this.width / 2 + 1.5) / (tan * this.camera.aspect);
    this.distance = Math.max(fitHeight, fitWidth) + 1;
    this.onResize?.();
  }
}

/**
 * A small hand-drawn tile in the spirit of the original handheld blocks: a dark outline, a light
 * inset square and a bright pixel in the corner. It is white-based, so the piece colour tints it.
 */
function createTileTexture(): THREE.CanvasTexture {
  const size = 16; // drawn pixel by pixel, then scaled up without smoothing
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#4a4a4a'; // outline
  ctx.fillRect(0, 0, size, 1);
  ctx.fillRect(0, size - 1, size, 1);
  ctx.fillRect(0, 0, 1, size);
  ctx.fillRect(size - 1, 0, 1, size);
  ctx.fillStyle = '#ffffff'; // inset square
  ctx.fillRect(3, 3, size - 6, size - 6);
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(5, 5, size - 10, size - 10);
  ctx.fillStyle = '#ffffff'; // highlight pixel
  ctx.fillRect(4, 4, 2, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
