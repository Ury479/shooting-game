/* =========================================================================
   火力前线 · 3D 射击生存游戏 (Three.js)
   操作：WASD 移动 / 鼠标视角+射击 / 1 2 3 Q 切换武器 / R 换弹
         Shift 冲刺 / 空格 翻滚 / Esc 暂停
   ========================================================================= */

(function () {
  'use strict';

  /* ---------- 基础常量 ---------- */
  const BOUND = 46;          // 场地半径
  const CAM_DIST = 4.6;      // 相机距离
  const PLAYER_R = 0.45;     // 玩家碰撞半径

  /* ---------- DOM ---------- */
  const canvas = document.getElementById('game');
  const hpBar = document.getElementById('hp-bar');
  const stBar = document.getElementById('st-bar');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const killsEl = document.getElementById('kills');
  const weaponNameEl = document.getElementById('weapon-name');
  const ammoEl = document.getElementById('ammo');
  const reloadHintEl = document.getElementById('reload-hint');
  const hitmarkEl = document.getElementById('hitmark');
  const vignetteEl = document.getElementById('vignette');
  const waveBannerEl = document.getElementById('wave-banner');
  const startOverlay = document.getElementById('start-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const deathOverlay = document.getElementById('death-overlay');
  const startBtn = document.getElementById('start-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const restartBtn = document.getElementById('restart-btn');
  const finalScoreEl = document.getElementById('final-score');
  const finalWaveEl = document.getElementById('final-wave');
  const finalKillsEl = document.getElementById('final-kills');

  /* ---------- 渲染器 / 场景 / 相机 ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1420);
  scene.fog = new THREE.FogExp2(0x0d1420, 0.014);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);

  /* ---------- 灯光 ---------- */
  const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x1a2430, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.position.set(28, 46, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const muzzleLight = new THREE.PointLight(0xffc46b, 0, 18, 1.8);
  scene.add(muzzleLight);

  /* ---------- 材质 ---------- */
  const MAT = {
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.45, metalness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x262b34, roughness: 0.55, metalness: 0.5 }),
    body: new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.6, metalness: 0.2 }),
    bodyDark: new THREE.MeshStandardMaterial({ color: 0x1e4d68, roughness: 0.6, metalness: 0.2 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x35e0ff, roughness: 0.2, metalness: 0.1, emissive: 0x0e3a44, emissiveIntensity: 1.2 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.7, metalness: 0.1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd8a97a, roughness: 0.8, metalness: 0 })
  };

  /* ---------- 地面 ---------- */
  function makeGroundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#141b28';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#1d2a3d';
    g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.strokeStyle = '#253650';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(28, 28);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.isGround = true;
  scene.add(ground);

  /* ---------- 障碍物（掩体箱子） ---------- */
  const obstacles = [];
  const obstacleMeshes = [];
  function addObstacle(x, z, w, d, h, color) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.isObstacle = true;
    mesh.userData.half = { w: w / 2, d: d / 2 };
    scene.add(mesh);
    obstacleMeshes.push(mesh);
    obstacles.push({ x, z, hw: w / 2, hd: d / 2, mesh });
  }
  function scatterObstacles() {
    const palette = [0x7a5a3a, 0x8a6a44, 0x5b4a72, 0x4a6a5a, 0x7a4a4a];
    const pts = [
      [9, 9, 2.4, 2.4, 2.6], [-9, 7, 3.2, 2, 2.2], [11, -8, 2.4, 2.4, 3.2],
      [-10, -10, 2.8, 2.8, 2.2], [18, 4, 2.2, 3.4, 2.4], [-18, -3, 3.4, 2.2, 2.6],
      [4, 18, 2.6, 2.6, 2.2], [-5, -18, 3, 2.2, 2.8], [22, -18, 2.4, 2.4, 2.2],
      [-24, 14, 2.8, 2.8, 2.4], [0, -27, 3.4, 2.4, 2.6], [-15, 22, 2.4, 2.4, 2.2]
    ];
    pts.forEach(function (p, i) {
      addObstacle(p[0], p[1], p[2], p[3], p[4], palette[i % palette.length]);
    });
  }
  scatterObstacles();

  /* ---------- 粒子（火花 / 尘土 / 弹壳） ---------- */
  function makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,.85)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const glowTex = makeGlowTexture();

  const particles = [];
  function spawnParticle(opts) {
    if (particles.length > 400) particles.shift();
    const mat = new THREE.SpriteMaterial({
      map: glowTex, color: opts.color || 0xffffff, transparent: true,
      opacity: opts.opacity || 1, depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(opts.pos);
    s.scale.setScalar(opts.size || 0.2);
    s.userData = {
      vel: opts.vel || new THREE.Vector3(),
      life: opts.life || 0.5,
      maxLife: opts.life || 0.5,
      gravity: opts.gravity || 0,
      grow: opts.grow || 0,
      fade: opts.fade !== false
    };
    scene.add(s);
    particles.push(s);
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const u = p.userData;
      u.life -= dt;
      if (u.life <= 0) { scene.remove(p); p.material.dispose(); particles.splice(i, 1); continue; }
      u.vel.y -= u.gravity * dt;
      p.position.addScaledVector(u.vel, dt);
      if (u.grow) { const s = p.scale.x + u.grow * dt; p.scale.setScalar(s); }
      if (u.fade) p.material.opacity = Math.max(0, u.life / u.maxLife) * (u.opacity0 !== undefined ? u.opacity0 : 1);
    }
  }
  function burstSparks(pos, color, n) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 1,
        (Math.random() - 0.5) * 6
      );
      spawnParticle({ pos: pos.clone(), vel: v, color, size: 0.08 + Math.random() * 0.08, life: 0.25 + Math.random() * 0.2, gravity: 12, additive: true, opacity: 1 });
    }
  }
  function dustPuff(pos, n, big) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * (big ? 3 : 1.6),
        Math.random() * (big ? 2.2 : 1.2),
        (Math.random() - 0.5) * (big ? 3 : 1.6)
      );
      spawnParticle({ pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4)), vel: v, color: 0x9aa3ad, size: 0.16 + Math.random() * 0.14, life: 0.5 + Math.random() * 0.35, gravity: 1.5, fade: true, opacity: 0.45 });
    }
  }

  /* ---------- 弹道拖尾 ---------- */
  const tracers = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.visible = false;
    m.userData.life = 0;
    scene.add(m);
    tracers.push(m);
  }
  function spawnTracer(from, to) {
    const t = tracers.find(function (x) { return !x.visible; }) || tracers[0];
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.01) return;
    t.position.copy(from).addScaledVector(dir, 0.5);
    t.scale.set(1, 1, len);
    t.lookAt(to);
    t.visible = true;
    t.userData.life = 0.05;
    t.material.opacity = 0.95;
  }
  function updateTracers(dt) {
    tracers.forEach(function (t) {
      if (!t.visible) return;
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.05) * 0.95;
      if (t.userData.life <= 0) t.visible = false;
    });
  }

  /* ---------- 枪口闪光 ---------- */
  const flashes = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffc46b, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.visible = false;
    s.userData.life = 0;
    scene.add(s);
    flashes.push(s);
  }
  function spawnFlash(pos) {
    const f = flashes.find(function (x) { return !x.visible; }) || flashes[0];
    f.position.copy(pos);
    f.visible = true;
    f.userData.life = 0.06;
    f.material.opacity = 1;
    f.scale.setScalar(0.6 + Math.random() * 0.5);
    f.material.rotation = Math.random() * Math.PI * 2;
    muzzleLight.position.copy(pos);
    muzzleLight.intensity = 5;
  }
  function updateFlashes(dt) {
    flashes.forEach(function (f) {
      if (!f.visible) return;
      f.userData.life -= dt;
      f.material.opacity = Math.max(0, f.userData.life / 0.06);
      if (f.userData.life <= 0) f.visible = false;
    });
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 90);
  }

  /* ---------- 武器配置 ---------- */
  const WEAPONS = {
    pistol: {
      name: '手枪', key: 1, auto: false, damage: 26, interval: 0.22, spread: 0.012,
      pellets: 1, mag: 12, reserve: 60, reload: 0.9, recoil: 0.16, kick: 0.6, color: 0xd9d9d9
    },
    rifle: {
      name: '突击步枪', key: 2, auto: true, damage: 15, interval: 0.085, spread: 0.025,
      pellets: 1, mag: 30, reserve: 150, reload: 1.5, recoil: 0.1, kick: 0.5, color: 0x3a8f5f
    },
    shotgun: {
      name: '霰弹枪', key: 3, auto: false, damage: 11, interval: 0.75, spread: 0.09,
      pellets: 8, mag: 6, reserve: 36, reload: 2.0, recoil: 0.5, kick: 1.4, color: 0xb06a3a
    }
  };
  const WEAPON_ORDER = ['pistol', 'rifle', 'shotgun'];

  /* ---------- 武器模型 ---------- */
  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
  function cyl(r, len, mat) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    c.rotation.x = Math.PI / 2;
    return c;
  }
  function buildGun(type) {
    const cfg = WEAPONS[type];
    const accent = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.4, metalness: 0.6 });
    const g = new THREE.Group();
    const muzzle = new THREE.Object3D();
    const eject = new THREE.Object3D();

    if (type === 'pistol') {
      g.add(box(0.09, 0.13, 0.32, MAT.dark));
      const slide = box(0.075, 0.06, 0.3, MAT.metal); slide.position.y = 0.09; g.add(slide);
      const barrel = cyl(0.025, 0.1, MAT.metal); barrel.position.set(0, 0.09, 0.2); g.add(barrel);
      const grip = box(0.085, 0.2, 0.11, accent); grip.position.set(0, -0.13, -0.06); grip.rotation.x = 0.25; g.add(grip);
      muzzle.position.set(0, 0.09, 0.32);
      eject.position.set(0.05, 0.1, 0.02);
    } else if (type === 'rifle') {
      g.add(box(0.09, 0.13, 0.6, MAT.dark));
      const barrel = cyl(0.024, 0.42, MAT.metal); barrel.position.set(0, 0.03, 0.5); g.add(barrel);
      const stock = box(0.08, 0.12, 0.24, MAT.dark); stock.position.set(0, -0.02, -0.4); g.add(stock);
      const mag = box(0.055, 0.24, 0.1, accent); mag.position.set(0, -0.17, 0.04); mag.rotation.x = 0.18; g.add(mag);
      const grip = box(0.06, 0.15, 0.09, accent); grip.position.set(0, -0.13, -0.2); grip.rotation.x = 0.2; g.add(grip);
      const scope = cyl(0.04, 0.18, MAT.metal); scope.position.set(0, 0.13, 0.05); g.add(scope);
      const tip = box(0.05, 0.05, 0.08, MAT.metal); tip.position.set(0, 0.03, 0.7); g.add(tip);
      muzzle.position.set(0, 0.03, 0.76);
      eject.position.set(0.06, 0.08, 0.05);
    } else {
      const barrel = cyl(0.034, 0.5, MAT.metal); barrel.position.set(0, 0.02, 0.28); g.add(barrel);
      const recv = box(0.09, 0.12, 0.32, MAT.dark); recv.position.set(0, 0, 0.06); g.add(recv);
      const pump = box(0.1, 0.09, 0.16, accent); pump.position.set(0, -0.02, 0.3); g.add(pump);
      const stock = box(0.08, 0.13, 0.28, MAT.dark); stock.position.set(0, -0.02, -0.32); g.add(stock);
      const tube = cyl(0.03, 0.3, MAT.metal); tube.position.set(0, -0.06, 0.26); g.add(tube);
      muzzle.position.set(0, 0.02, 0.58);
      eject.position.set(0.06, 0.08, -0.04);
    }
    muzzle.name = 'muzzle';
    eject.name = 'eject';
    g.add(muzzle); g.add(eject);
    g.userData.muzzle = muzzle;
    g.userData.eject = eject;
    return g;
  }

  /* ---------- 玩家角色 ---------- */
  const player = {
    pos: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0.24,
    vel: new THREE.Vector3(),
    hp: 100,
    stamina: 100,
    alive: true
  };
  const keys = {};
  let firing = false;

  // 根节点（含移动/摆头）
  const playerRoot = new THREE.Group();
  playerRoot.position.copy(player.pos);
  scene.add(playerRoot);

  // 身体节点（随 yaw 旋转）
  const bodyNode = new THREE.Group();
  playerRoot.add(bodyNode);

  // 躯干
  const torso = box(0.6, 0.72, 0.34, MAT.body);
  torso.position.y = 1.45; torso.castShadow = true;
  bodyNode.add(torso);
  const chest = box(0.5, 0.3, 0.26, MAT.bodyDark);
  chest.position.set(0, 1.55, 0.08); chest.castShadow = true;
  bodyNode.add(chest);

  // 头
  const head = box(0.34, 0.3, 0.34, MAT.body);
  head.position.y = 2.02; head.castShadow = true;
  bodyNode.add(head);
  const visor = box(0.28, 0.1, 0.06, MAT.visor);
  visor.position.set(0, 2.04, 0.18);
  bodyNode.add(visor);

  // 四肢（枢轴在关节，摆动更自然）
  function makeLimb(w, h, d, mat, px, py) {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const m = box(w, h, d, mat);
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    bodyNode.add(pivot);
    return { pivot, mesh: m };
  }
  const armL = makeLimb(0.16, 0.6, 0.16, MAT.body, -0.38, 1.72);
  const armR = makeLimb(0.16, 0.6, 0.16, MAT.bodyDark, 0.38, 1.72);
  const legL = makeLimb(0.22, 0.9, 0.22, MAT.bodyDark, -0.18, 1.0);
  const legR = makeLimb(0.22, 0.9, 0.22, MAT.bodyDark, 0.18, 1.0);
  const bootL = box(0.24, 0.14, 0.3, MAT.boot); bootL.position.set(-0.18, 0.12, 0.06); bootL.castShadow = true; bodyNode.add(bootL);
  const bootR = box(0.24, 0.14, 0.3, MAT.boot); bootR.position.set(0.18, 0.12, 0.06); bootR.castShadow = true; bodyNode.add(bootR);

  // 武器挂点（双手持握位置）
  const WEAPON_BASE = { x: 0.12, y: 1.5, z: 0.36 };
  const weaponHolder = new THREE.Group();
  weaponHolder.position.set(WEAPON_BASE.x, WEAPON_BASE.y, WEAPON_BASE.z);
  bodyNode.add(weaponHolder);
  let recoilPitch = 0, recoilZ = 0;

  // 生成三把武器并放入挂点
  const gunGroups = {};
  WEAPON_ORDER.forEach(function (type) {
    const g = buildGun(type);
    g.visible = false;
    g.position.set(0, 0.02, 0);
    weaponHolder.add(g);
    gunGroups[type] = g;
  });

  let currentWeapon = 'rifle';
  let reloading = false;
  let reloadTimer = 0;
  let switchTimer = 0;
  const ammo = { pistol: 12, rifle: 30, shotgun: 6 };
  const reserve = { pistol: 60, rifle: 150, shotgun: 36 };
  let lastShotAt = -10;

  function currentGun() { return gunGroups[currentWeapon]; }
  function currentCfg() { return WEAPONS[currentWeapon]; }

  function switchWeapon(type) {
    if (type === currentWeapon || switchTimer > 0) return;
    WEAPON_ORDER.forEach(function (t) { gunGroups[t].visible = false; });
    currentWeapon = type;
    reloading = false;
    reloadTimer = 0;
    gunGroups[type].visible = true;
    switchTimer = 0.22;
    updateHudAmmo();
    playSound('switch');
  }
  function cycleWeapon(dir) {
    const idx = WEAPON_ORDER.indexOf(currentWeapon);
    const next = WEAPON_ORDER[(idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    switchWeapon(next);
  }

  /* ---------- 敌人 ---------- */
  const enemies = [];
  const ENEMY_TYPES = {
    walker: { hp: 60, speed: 3.2, damage: 12, scale: 1.0, color: 0xe74c3c, score: 100, name: '突击兵' },
    runner: { hp: 34, speed: 6.4, damage: 8, scale: 0.78, color: 0xf5a623, score: 150, name: '疾行者' },
    brute:  { hp: 220, speed: 1.9, damage: 26, scale: 1.6, color: 0x9b59b6, score: 300, name: '重装兵' }
  };

  function makeEnemy(type) {
    const cfg = ENEMY_TYPES[type];
    const s = cfg.scale;
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });

    const body = box(0.7, 0.8, 0.45, mat);
    body.position.y = 1.0; body.castShadow = true; grp.add(body);
    const head = box(0.5, 0.42, 0.42, mat);
    head.position.y = 1.72; head.castShadow = true; grp.add(head);
    const eyeL = box(0.16, 0.1, 0.06, MAT.visor); eyeL.position.set(-0.12, 1.75, 0.22); grp.add(eyeL);
    const eyeR = box(0.16, 0.1, 0.06, MAT.visor); eyeR.position.set(0.12, 1.75, 0.22); grp.add(eyeR);
    const legPivots = [];
    [-0.2, 0.2].forEach(function (x) {
      const p = new THREE.Group(); p.position.set(x, 0.6, 0);
      const l = box(0.22, 0.6, 0.22, dark); l.position.y = -0.3; l.castShadow = true; p.add(l);
      grp.add(p); legPivots.push(p);
    });
    const armPivots = [];
    [-0.5, 0.5].forEach(function (x) {
      const p = new THREE.Group(); p.position.set(x, 1.25, 0);
      const a = box(0.16, 0.55, 0.16, dark); a.position.y = -0.27; a.castShadow = true; p.add(a);
      grp.add(p); armPivots.push(p);
    });

    // 血条（挂在场景层，便于始终面向相机）
    const hbBack = box(0.9, 0.12, 0.04, new THREE.MeshBasicMaterial({ color: 0x220b0b, depthTest: true }));
    const hbFront = box(0.88, 0.08, 0.04, new THREE.MeshBasicMaterial({ color: 0x3dff6b }));
    hbBack.scale.setScalar(s);
    hbFront.scale.set(s, s, s);
    scene.add(hbBack); scene.add(hbFront);

    grp.scale.setScalar(s);
    grp.traverse(function (o) { if (o.isMesh) o.userData.enemy = true; });
    scene.add(grp);

    const meshes = [];
    grp.traverse(function (o) { if (o.isMesh && o.geometry) meshes.push(o); });

    return {
      type, cfg, group: grp, meshes, bodyMesh: body,
      hp: cfg.hp * (1 + (wave - 1) * 0.28),
      maxHp: cfg.hp * (1 + (wave - 1) * 0.28),
      walkPhase: Math.random() * Math.PI * 2,
      hitCooldown: 0,
      attackCooldown: Math.random() * 0.5,
      alive: true,
      legPivots, armPivots, hbBack, hbFront,
      dieScale: s
    };
  }

  function spawnEnemy(type) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 16;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const e = makeEnemy(type);
    Object.assign(e, enemyProto);
    e.group.position.set(x, 0, z);
    enemies.push(e);
  }

  function pickEnemyType() {
    const r = Math.random();
    if (wave >= 3 && r < 0.16) return 'brute';
    if (wave >= 2 && r < 0.42) return 'runner';
    return 'walker';
  }

  /* ---------- 波次 ---------- */
  let wave = 0;
  let waveState = 'idle'; // idle | spawning | fighting | cleared
  let spawnQueue = [];
  let spawnTimer = 0;
  let waveDelay = 0;
  let score = 0;
  let kills = 0;
  let enemyCount = 0;

  function startWave(n) {
    wave = n;
    waveState = 'spawning';
    spawnQueue = [];
    const count = 6 + n * 2;
    enemyCount = count;
    for (let i = 0; i < count; i++) spawnQueue.push(pickEnemyType());
    spawnTimer = 0;
    showBanner('第 ' + n + ' 波');
    waveEl.textContent = n;
  }

  function showBanner(text) {
    waveBannerEl.textContent = text;
    waveBannerEl.style.opacity = 1;
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(function () { waveBannerEl.style.opacity = 0; }, 1500);
  }

  /* ---------- 音频（WebAudio 合成） ---------- */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function noiseBuffer() {
    if (!audioCtx) return null;
    const len = audioCtx.sampleRate * 0.4;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let _noise = null;
  function playSound(kind) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    function blip(freq, dur, vol, type, slide) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur);
    }
    if (kind === 'shot') {
      const cfg = currentCfg();
      if (!_noise) _noise = noiseBuffer();
      const src = audioCtx.createBufferSource();
      src.buffer = _noise;
      const f = audioCtx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cfg.pellets > 1 ? 1600 : 3000;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (cfg.pellets > 1 ? 0.3 : 0.12));
      src.connect(f).connect(g).connect(audioCtx.destination);
      src.start(t); src.stop(t + 0.4);
      blip(140, 0.1, 0.5, 'square', -80);
    } else if (kind === 'reload') {
      blip(300, 0.06, 0.3, 'square'); setTimeout(function () { blip(220, 0.06, 0.3, 'square'); }, 120);
    } else if (kind === 'switch') {
      blip(520, 0.05, 0.25, 'square'); blip(760, 0.05, 0.2, 'square');
    } else if (kind === 'hit') {
      blip(880, 0.06, 0.28, 'triangle', -300);
    } else if (kind === 'kill') {
      blip(600, 0.08, 0.3, 'square', 300);
    } else if (kind === 'hurt') {
      blip(160, 0.2, 0.5, 'sawtooth', -60);
    } else if (kind === 'empty') {
      blip(220, 0.04, 0.2, 'square');
    }
  }

  /* ---------- 射击 ---------- */
  const ray = new THREE.Raycaster();
  ray.far = 300;

  function rayTargets() {
    const list = [ground].concat(obstacleMeshes);
    enemies.forEach(function (e) { e.meshes.forEach(function (m) { list.push(m); }); });
    return list;
  }

  function muzzleWorldPos() {
    const v = new THREE.Vector3();
    currentGun().userData.muzzle.getWorldPosition(v);
    return v;
  }
  function ejectWorldPos() {
    const v = new THREE.Vector3();
    currentGun().userData.eject.getWorldPosition(v);
    return v;
  }

  function tryFire() {
    const cfg = currentCfg();
    if (!player.alive || reloading || switchTimer > 0) return;
    if (timeNow - lastShotAt < cfg.interval) return;
    if (ammo[currentWeapon] <= 0) {
      playSound('empty');
      startReload();
      return;
    }
    lastShotAt = timeNow;
    ammo[currentWeapon]--;

    // 计算准星瞄准点（从相机中心射一条线）
    const targets = rayTargets();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const aimHits = ray.intersectObjects(targets, false);
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const aimPoint = aimHits.length ? aimHits[0].point.clone() : camera.position.clone().addScaledVector(camDir, 90);

    const muzzle = muzzleWorldPos();

    // 每颗弹丸独立判定
    for (let p = 0; p < cfg.pellets; p++) {
      const dir = aimPoint.clone().sub(muzzle).normalize();
      dir.x += (Math.random() - 0.5) * cfg.spread * 2;
      dir.y += (Math.random() - 0.5) * cfg.spread * 2;
      dir.z += (Math.random() - 0.5) * cfg.spread * 2;
      dir.normalize();

      ray.set(muzzle, dir);
      const hits = ray.intersectObjects(targets, false);
      let end = muzzle.clone().addScaledVector(dir, 90);
      let hitEnemy = null;
      for (let i = 0; i < hits.length; i++) {
        const o = hits[i].object;
        if (o.userData.isGround || o.userData.isObstacle) { end = hits[i].point; break; }
        if (o.userData.enemy) { end = hits[i].point; hitEnemy = findEnemyByMesh(o); break; }
      }

      spawnTracer(muzzle, end);
      if (hitEnemy) {
        hitEnemy.takeDamage(cfg.damage, dir);
        hitmark(0);
        burstSparks(end, 0xffc46b, 3);
      } else {
        burstSparks(end, 0x9fb4d8, 2);
      }
    }

    spawnFlash(muzzle);

    // 后坐力
    recoilZ += cfg.recoil * 0.4;
    recoilPitch += cfg.recoil * 0.7;
    shake += cfg.kick * 0.5;

    // 抛壳
    const ev = ejectWorldPos();
    const shellV = new THREE.Vector3(
      (Math.random() - 0.5) * 2, Math.random() * 2 + 1.5, Math.random() * 1.5 - 0.5
    );
    spawnParticle({ pos: ev, vel: shellV, color: 0xd8b45a, size: 0.07, life: 0.9, gravity: 9, fade: true, opacity: 1 });

    playSound('shot');
    updateHudAmmo();

    if (ammo[currentWeapon] <= 0) startReload();
  }

  function findEnemyByMesh(mesh) {
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].meshes.indexOf(mesh) >= 0) return enemies[i];
    }
    return null;
  }

  function hitmark(kill) {
    hitmarkEl.style.opacity = 1;
    hitmarkEl.className = kill ? 'kill' : '';
    clearTimeout(hitmark._t);
    hitmark._t = setTimeout(function () { hitmarkEl.style.opacity = 0; }, 120);
  }

  function startReload() {
    const cfg = currentCfg();
    if (reloading) return;
    if (ammo[currentWeapon] >= cfg.mag) return;
    if (reserve[currentWeapon] <= 0) return;
    reloading = true;
    reloadTimer = cfg.reload;
    reloadHintEl.textContent = '换弹中…';
    playSound('reload');
  }
  function finishReload() {
    const cfg = currentCfg();
    const need = cfg.mag - ammo[currentWeapon];
    const take = Math.min(need, reserve[currentWeapon]);
    ammo[currentWeapon] += take;
    reserve[currentWeapon] -= take;
    reloading = false;
    reloadHintEl.textContent = '';
    updateHudAmmo();
  }

  /* ---------- 受击 ---------- */
  function damagePlayer(dmg) {
    if (!player.alive) return;
    player.hp -= dmg;
    shake += 0.9;
    vignetteEl.style.opacity = 0.9;
    playSound('hurt');
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
  }

  /* ---------- 碰撞 ---------- */
  function pushOutOfObstacles(p, radius) {
    obstacles.forEach(function (o) {
      const cx = Math.max(o.x - o.hw, Math.min(p.x, o.x + o.hw));
      const cz = Math.max(o.z - o.hd, Math.min(p.z, o.z + o.hd));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        let d = Math.sqrt(d2);
        if (d < 0.001) { dx = 0; dz = 1; d = 1; }
        const push = (radius - d) / d;
        p.x += dx * push;
        p.z += dz * push;
      }
    });
  }

  /* ---------- 屏幕震动 ---------- */
  let shake = 0;

  /* ---------- 计分 HUD ---------- */
  function updateHudAmmo() {
    const cfg = currentCfg();
    weaponNameEl.textContent = cfg.name;
    ammoEl.innerHTML = ammo[currentWeapon] + ' <small>/ ' + reserve[currentWeapon] + '</small>';
  }
  function updateHud() {
    hpBar.style.width = Math.max(0, player.hp) + '%';
    stBar.style.width = Math.max(0, player.stamina) + '%';
    scoreEl.textContent = score;
    waveEl.textContent = Math.max(1, wave);
    killsEl.textContent = kills;
  }

  /* ---------- 游戏状态 ---------- */
  let gameStarted = false;
  let running = false;
  let timeNow = 0;

  function startGame() {
    score = 0; kills = 0;
    player.hp = 100; player.stamina = 100; player.alive = true;
    player.pos.set(0, 0, 0); player.vel.set(0, 0, 0); player.yaw = 0; player.pitch = 0.24;
    enemies.forEach(function (e) { scene.remove(e.group); scene.remove(e.hbBack); scene.remove(e.hbFront); });
    enemies.length = 0;
    ammo.pistol = 12; ammo.rifle = 30; ammo.shotgun = 6;
    reserve.pistol = 60; reserve.rifle = 150; reserve.shotgun = 36;
    reloading = false; reloadTimer = 0; switchTimer = 0;
    dodgeT = 0; dodgeCd = 0; shake = 0;
    startWave(1);
    updateHudAmmo();
    updateHud();
    deathOverlay.classList.add('hidden');
    startOverlay.classList.add('hidden');
    gameStarted = true;
  }

  function gameOver() {
    player.alive = false;
    running = false;
    firing = false;
    finalScoreEl.textContent = score;
    finalWaveEl.textContent = wave;
    finalKillsEl.textContent = kills;
    deathOverlay.classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
  }

  /* ---------- 输入 ---------- */
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'KeyR') startReload();
    if (e.code === 'Digit1') switchWeapon('pistol');
    if (e.code === 'Digit2') switchWeapon('rifle');
    if (e.code === 'Digit3') switchWeapon('shotgun');
    if (e.code === 'KeyQ') cycleWeapon(1);
    if (e.code === 'Space') tryDodge();
  });
  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });
  window.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (!gameStarted || !running) return;
    firing = true;
    if (!currentCfg().auto) tryFire();
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) firing = false;
  });
  window.addEventListener('mousemove', function (e) {
    if (!running) return;
    const sx = e.movementX || 0, sy = e.movementY || 0;
    player.yaw += sx * 0.0024;
    player.pitch -= sy * 0.0024;
    player.pitch = Math.max(-0.5, Math.min(1.15, player.pitch));
  });
  window.addEventListener('wheel', function (e) {
    if (!running) return;
    if (Math.abs(e.deltaY) > 5) cycleWeapon(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  // 翻滚
  let dodgeT = 0, dodgeCd = 0;
  function tryDodge() {
    if (!running || !player.alive) return;
    if (dodgeT > 0 || dodgeCd > 0 || player.stamina < 20) return;
    player.stamina -= 20;
    dodgeT = 0.38;
    dodgeCd = 0.9;
    const dir = moveDir.clone();
    if (dir.lengthSq() < 0.001) dir.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    dir.normalize();
    player.vel.addScaledVector(dir, 14);
    dustPuff(player.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 10, true);
  }

  /* ---------- 指针锁定 ---------- */
  document.addEventListener('pointerlockchange', function () {
    const locked = document.pointerLockElement === canvas;
    if (locked) {
      if (!gameStarted) return;
      running = true;
      pauseOverlay.classList.add('hidden');
    } else {
      if (gameStarted && player.alive) {
        running = false;
        firing = false;
        pauseOverlay.classList.remove('hidden');
      }
    }
  });

  startBtn.addEventListener('click', function () {
    ensureAudio();
    startGame();
    canvas.requestPointerLock();
  });
  resumeBtn.addEventListener('click', function () {
    ensureAudio();
    canvas.requestPointerLock();
  });
  restartBtn.addEventListener('click', function () {
    ensureAudio();
    startGame();
    canvas.requestPointerLock();
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------- 移动方向（缓存向量） ---------- */
  const moveDir = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  /* ---------- 主循环 ---------- */
  const clock = new THREE.Clock();
  let dustAcc = 0;
  let bobT = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (running && player.alive) timeNow += dt;

    if (running && player.alive) {
      updatePlayer(dt);
      updateEnemies(dt);
      updateWaves(dt);
    }
    updateParticles(dt);
    updateTracers(dt);
    updateFlashes(dt);
    updateCamera(dt);
    // 受击红幕淡出
    const vop = parseFloat(vignetteEl.style.opacity || '0');
    if (vop > 0) vignetteEl.style.opacity = Math.max(0, vop - dt * 2.2).toFixed(3);
    updateHud();
    renderer.render(scene, camera);
  }

  function updatePlayer(dt) {
    if (!player.alive) return;

    // 体力恢复
    const sprinting = keys['ShiftLeft'] || keys['ShiftRight'];
    if (!sprinting && dodgeT <= 0) player.stamina = Math.min(100, player.stamina + 16 * dt);

    // 输入方向
    let f = 0, s = 0;
    if (keys['KeyW'] || keys['ArrowUp']) f += 1;
    if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) s += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) s -= 1;

    fwd.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    moveDir.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, s);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const canSprint = sprinting && f > 0 && player.stamina > 0;
    let speed = 5.2;
    if (canSprint) { speed = 8.6; player.stamina = Math.max(0, player.stamina - 22 * dt); }

    // 加速度 / 摩擦
    const target = moveDir.clone().multiplyScalar(speed);
    const accel = moveDir.lengthSq() > 0 ? 40 : 26;
    player.vel.x += (target.x - player.vel.x) * Math.min(1, accel * dt);
    player.vel.z += (target.z - player.vel.z) * Math.min(1, accel * dt);
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.z * dt;

    // 翻滚计时
    if (dodgeT > 0) dodgeT -= dt;
    if (dodgeCd > 0) dodgeCd -= dt;

    // 边界与障碍碰撞
    const b = BOUND;
    player.pos.x = Math.max(-b, Math.min(b, player.pos.x));
    player.pos.z = Math.max(-b, Math.min(b, player.pos.z));
    pushOutOfObstacles(player.pos, PLAYER_R);

    playerRoot.position.copy(player.pos);

    // 移动动画
    const speedRatio = Math.min(1, Math.hypot(player.vel.x, player.vel.z) / speed);
    const moving = speedRatio > 0.05;
    if (moving) bobT += dt * (canSprint ? 13 : 9.5);
    const swing = moving ? speedRatio : 0;
    const amp = 0.7 * swing;

    playerRoot.position.y = Math.abs(Math.sin(bobT)) * 0.09 * swing;
    legL.pivot.rotation.x = Math.sin(bobT) * amp;
    legR.pivot.rotation.x = Math.sin(bobT + Math.PI) * amp;
    armL.pivot.rotation.x = Math.sin(bobT + Math.PI) * amp * 0.8;
    armR.pivot.rotation.x = Math.sin(bobT) * amp * 0.7;

    // 冲刺前倾 & 翻滚蜷缩
    let lean = 0;
    if (canSprint) lean = 0.28;
    bodyNode.rotation.x = lean + (dodgeT > 0 ? 0.5 : 0);
    if (dodgeT > 0) {
      playerRoot.rotation.z = 0;
      playerRoot.position.y = 0.25;
    }

    // 面向移动/射击方向
    bodyNode.rotation.y = player.yaw;

    // 武器瞄准俯仰 + 后坐力回弹
    recoilPitch += (0 - recoilPitch) * Math.min(1, 12 * dt);
    recoilZ += (0 - recoilZ) * Math.min(1, 12 * dt);
    weaponHolder.rotation.x = player.pitch + recoilPitch;
    weaponHolder.position.z = WEAPON_BASE.z - recoilZ;

    // 换弹 / 切枪计时
    if (reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) finishReload();
    }
    if (switchTimer > 0) switchTimer -= dt;

    // 自动射击
    if (firing && currentCfg().auto) tryFire();

    // 移动尘土
    if (moving && speedRatio > 0.4) {
      dustAcc += dt;
      if (dustAcc > 0.12) {
        dustAcc = 0;
        dustPuff(player.pos.clone(), canSprint ? 2 : 1, false);
      }
    }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dying) {
        const grp = e.group;
        grp.rotation.x = Math.max(-Math.PI / 2, grp.rotation.x - 3.2 * dt);
        grp.position.y += dt * 0.5;
        const sc = grp.scale.x - 1.4 * dt * e.dieScale;
        if (sc <= 0.02) { scene.remove(grp); scene.remove(e.hbBack); scene.remove(e.hbFront); enemies.splice(i, 1); }
        else grp.scale.setScalar(sc);
        continue;
      }
      e.hitCooldown -= dt;
      e.attackCooldown -= dt;
      e.walkPhase += dt * (4 + e.cfg.speed * 1.4);

      // 朝向玩家并靠近
      const toP = new THREE.Vector3(player.pos.x - e.group.position.x, 0, player.pos.z - e.group.position.z);
      const dist = toP.length();
      if (dist > 0.001) {
        toP.normalize();
        e.group.rotation.y = Math.atan2(toP.x, toP.z);
        if (dist > 1.0) e.group.position.addScaledVector(toP, e.cfg.speed * dt);
      }

      // 障碍碰撞
      const p2 = e.group.position;
      pushOutOfObstacles(p2, 0.5 * e.cfg.scale);

      // 攻击玩家
      if (dist < 1.2 * e.cfg.scale && e.attackCooldown <= 0 && player.alive) {
        e.attackCooldown = 1.0;
        damagePlayer(e.cfg.damage);
        const knock = toP.clone().multiplyScalar(-3);
        e.group.position.add(knock);
      }

      // 行走动画
      const s = Math.sin(e.walkPhase);
      e.legPivots[0].rotation.x = s * 0.7;
      e.legPivots[1].rotation.x = -s * 0.7;
      e.armPivots[0].rotation.x = -s * 0.5;
      e.armPivots[1].rotation.x = s * 0.5;

      // 血条朝向相机并跟随头顶
      const hp = new THREE.Vector3(0, 2.25, 0);
      e.group.localToWorld(hp);
      e.hbBack.position.copy(hp);
      e.hbFront.position.copy(hp);
      e.hbBack.quaternion.copy(camera.quaternion);
      e.hbFront.quaternion.copy(camera.quaternion);

      // 受击闪白
      if (e.hitCooldown > 0.06) {
        e.bodyMesh.material.emissive.setHex(0xffffff);
        e.bodyMesh.material.emissiveIntensity = 0.8;
      } else {
        e.bodyMesh.material.emissive.setHex(0x000000);
        e.bodyMesh.material.emissiveIntensity = 0;
      }
    }
  }

  // 敌人死亡 / 受击方法
  const enemyProto = {
    takeDamage: function (dmg, dir) {
      if (!this.alive) return;
      this.hp -= dmg;
      this.hitCooldown = 0.12;
      // 击退
      if (dir) this.group.position.addScaledVector(dir, 0.35);
      const ratio = Math.max(0, this.hp / this.maxHp);
      this.hbFront.scale.x = ratio * this.dieScale;
      if (this.hp <= 0) this.die();
    },
    die: function () {
      this.alive = false;
      this.dying = true;
      this.hbBack.visible = false;
      this.hbFront.visible = false;
      score += this.cfg.score;
      kills += 1;
      hitmark(1);
      playSound('kill');
      burstSparks(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)), this.cfg.color, 14);
    }
  };
  function updateWaves(dt) {
    if (waveState === 'spawning') {
      spawnTimer -= dt;
      if (spawnTimer <= 0 && spawnQueue.length > 0) {
        spawnEnemy(spawnQueue.shift());
        spawnTimer = Math.max(0.25, 1.0 - wave * 0.05);
      }
      if (spawnQueue.length === 0) waveState = 'fighting';
    } else if (waveState === 'fighting') {
      if (enemies.length === 0) {
        waveState = 'cleared';
        waveDelay = 2.2;
        showBanner('波次肃清！');
      }
    } else if (waveState === 'cleared') {
      waveDelay -= dt;
      if (waveDelay <= 0) startWave(wave + 1);
    }
  }

  /* ---------- 相机 ---------- */
  const pivot = new THREE.Vector3();
  const camOffset = new THREE.Vector3();
  const aimTarget = new THREE.Vector3();

  function updateCamera(dt) {
    pivot.set(player.pos.x, player.pos.y + 1.55, player.pos.z);

    const cy = Math.cos(player.yaw + Math.PI), sy = Math.sin(player.yaw + Math.PI);
    const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
    camOffset.set(sy * cp, sp, cy * cp);

    camera.position.copy(pivot).addScaledVector(camOffset, CAM_DIST);

    // 屏幕震动
    if (shake > 0.001) {
      shake = Math.max(0, shake - dt * 6);
      const amp = shake * 0.16;
      camera.position.x += (Math.random() - 0.5) * amp;
      camera.position.y += (Math.random() - 0.5) * amp;
      camera.position.z += (Math.random() - 0.5) * amp;
    }

    aimTarget.set(
      pivot.x + Math.sin(player.yaw) * cp * 30,
      pivot.y + sp * 30,
      pivot.z + Math.cos(player.yaw) * cp * 30
    );
    camera.lookAt(aimTarget);
  }

  /* ---------- 启动渲染循环 ---------- */
  // 初始显示步枪
  WEAPON_ORDER.forEach(function (t) { gunGroups[t].visible = false; });
  gunGroups.rifle.visible = true;
  updateHudAmmo();
  updateHud();
  animate();
})();
