import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FallingBlock } from '../game/board';
import type { Game } from '../game/game';
import type { Cell, PieceType } from '../game/pieces';
import type { Theme } from './themes';

const FOV = 40;
const BLOCK = 0.9;

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
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly board = new THREE.Group();
  private readonly blocks: THREE.InstancedMesh;
  private readonly ghost: THREE.InstancedMesh;
  private readonly frameMaterial = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  private readonly gridMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 });
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private theme: Theme;

  private azimuth = 0;
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
    this.blocks = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 }),
      cells + 4,
    );
    this.ghost = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }),
      4,
    );
    this.board.add(this.blocks, this.ghost, this.buildFrame(), this.buildGrid());
    this.scene.add(this.board);

    this.setTheme(theme);
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.scene.background = new THREE.Color(theme.background);
    this.frameMaterial.color.set(theme.frame);
    this.gridMaterial.color.set(theme.gridLines);
  }

  /** Starts the "bullet time" orbit: the camera travels half way around the board. */
  turnCamera(turns: number, duration: number): void {
    this.cameraTurn = { from: this.azimuth, to: turns * Math.PI, elapsed: 0, duration };
  }

  /** Starts the hourglass animation: the board rotates, then blocks fall. */
  playFlip(falls: FallingBlock[], duration: number): void {
    this.flip = { falls, elapsed: 0, duration };
  }

  resetCamera(): void {
    this.azimuth = 0;
    this.cameraTurn = null;
    this.flip = null;
  }

  render(game: Game, dt: number): void {
    this.animateCamera(dt);
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
    this.drawGhost(game.active?.type, game.ghostCells());

    this.renderer.render(this.scene, this.camera);
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

  private animateCamera(dt: number): void {
    let lift = 0;
    if (this.cameraTurn) {
      const turn = this.cameraTurn;
      turn.elapsed += dt;
      const t = clamp01(turn.elapsed / turn.duration);
      this.azimuth = turn.from + (turn.to - turn.from) * easeInOut(t);
      // Rise a little mid-orbit, like the Matrix bullet-time shot.
      lift = Math.sin(Math.PI * t) * 6;
      if (t >= 1) this.cameraTurn = null;
    }
    const d = this.distance;
    this.camera.position.set(Math.sin(this.azimuth) * d, 1.5 + lift, Math.cos(this.azimuth) * d);
    this.camera.lookAt(0, 0, 0);
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

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Keep the whole board in view, whatever the screen shape.
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const fitHeight = (this.height / 2 + 1.5) / tan;
    const fitWidth = (this.width / 2 + 1.5) / (tan * this.camera.aspect);
    this.distance = Math.max(fitHeight, fitWidth) + 1;
  }
}
