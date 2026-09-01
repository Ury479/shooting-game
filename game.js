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

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

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
      [-24, 14, 2.8, 2.8, 2.4], [0, -27, 3.4, 2.4, 2.6], [-15, 22, 2.4, 2.4, 2.2],
      [12, 2, 4, 4, 1.4], [-12, -2, 4, 4, 1.5], [3, 12, 4, 4, 1.3], [-3, -12, 3.5, 3.5, 1.4]
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
    f.scale.setScalar(0.14 + Math.random() * 0.08);
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
    pistol: { name:'手枪', key:1, auto:false, damage:26, interval:0.22, spread:0.012, pellets:1, mag:12, reserve:60, reload:0.9, recoil:0.16, kick:0.6, color:0xd9d9d9, price:0 },
    smg:    { name:'冲锋枪', key:2, auto:true, damage:10, interval:0.055, spread:0.035, pellets:1, mag:40, reserve:240, reload:1.3, recoil:0.08, kick:0.45, color:0x3a7bd5, price:500 },
    rifle:  { name:'突击步枪', key:3, auto:true, damage:15, interval:0.085, spread:0.025, pellets:1, mag:30, reserve:150, reload:1.5, recoil:0.1, kick:0.5, color:0x3a8f5f, price:800 },
    shotgun:{ name:'霰弹枪', key:4, auto:false, damage:11, interval:0.75, spread:0.09, pellets:8, mag:6, reserve:36, reload:2.0, recoil:0.5, kick:1.4, color:0xb06a3a, price:900 },
    sniper: { name:'狙击步枪', key:5, auto:false, damage:120, interval:1.15, spread:0.002, pellets:1, mag:5, reserve:25, reload:2.2, recoil:0.7, kick:2.2, color:0x5a5a6a, price:1200 },
    lmg:    { name:'轻机枪', key:6, auto:true, damage:14, interval:0.08, spread:0.05, pellets:1, mag:100, reserve:300, reload:2.6, recoil:0.14, kick:0.6, color:0x8a5a3a, price:1500 },
    melee:  { name:'军刀', key:7, auto:false, damage:70, interval:0.5, spread:0, pellets:0, mag:1, reserve:1, reload:0, recoil:0, kick:0, color:0xcccccc, price:0, melee:true }
  };
  const WEAPON_ORDER = ['pistol','smg','rifle','shotgun','sniper','lmg','melee'];

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
    } else if (type === 'smg') {
      g.add(box(0.09, 0.13, 0.55, MAT.dark));
      const barrel = cyl(0.02, 0.3, MAT.metal); barrel.position.set(0, 0.03, 0.42); g.add(barrel);
      const stock = box(0.07, 0.1, 0.2, MAT.dark); stock.position.set(0, -0.01, -0.35); g.add(stock);
      const mag = box(0.05, 0.22, 0.09, accent); mag.position.set(0, -0.16, 0.03); mag.rotation.x = 0.15; g.add(mag);
      const grip = box(0.06, 0.13, 0.08, accent); grip.position.set(0, -0.12, -0.2); g.add(grip);
      muzzle.position.set(0, 0.03, 0.6);
      eject.position.set(0.06, 0.08, 0.04);
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
    } else if (type === 'shotgun') {
      const barrel = cyl(0.034, 0.5, MAT.metal); barrel.position.set(0, 0.02, 0.28); g.add(barrel);
      const recv = box(0.09, 0.12, 0.32, MAT.dark); recv.position.set(0, 0, 0.06); g.add(recv);
      const pump = box(0.1, 0.09, 0.16, accent); pump.position.set(0, -0.02, 0.3); g.add(pump);
      const stock = box(0.08, 0.13, 0.28, MAT.dark); stock.position.set(0, -0.02, -0.32); g.add(stock);
      const tube = cyl(0.03, 0.3, MAT.metal); tube.position.set(0, -0.06, 0.26); g.add(tube);
      muzzle.position.set(0, 0.02, 0.58);
      eject.position.set(0.06, 0.08, -0.04);
    } else if (type === 'sniper') {
      g.add(box(0.08, 0.13, 0.7, MAT.dark));
      const barrel = cyl(0.022, 0.55, MAT.metal); barrel.position.set(0, 0.04, 0.55); g.add(barrel);
      const stock = box(0.08, 0.12, 0.26, MAT.dark); stock.position.set(0, -0.02, -0.45); g.add(stock);
      const mag = box(0.05, 0.18, 0.08, accent); mag.position.set(0, -0.15, 0.05); g.add(mag);
      const scope = cyl(0.045, 0.26, MAT.metal); scope.position.set(0, 0.16, 0.08); g.add(scope);
      muzzle.position.set(0, 0.04, 0.86);
      eject.position.set(0.06, 0.09, 0.1);
    } else if (type === 'lmg') {
      g.add(box(0.11, 0.15, 0.7, MAT.dark));
      const barrel = cyl(0.03, 0.5, MAT.metal); barrel.position.set(0, 0.03, 0.58); g.add(barrel);
      const boxMag = box(0.12, 0.2, 0.22, accent); boxMag.position.set(0, -0.18, 0.02); g.add(boxMag);
      const stock = box(0.08, 0.13, 0.24, MAT.dark); stock.position.set(0, -0.02, -0.46); g.add(stock);
      const handle = box(0.05, 0.12, 0.1, accent); handle.position.set(0, 0.12, -0.05); g.add(handle);
      muzzle.position.set(0, 0.03, 0.84);
      eject.position.set(0.08, 0.09, 0.06);
    } else if (type === 'melee') {
      const blade = box(0.05, 0.05, 0.34, MAT.metal); blade.position.set(0, 0.03, 0.22); g.add(blade);
      const tip = box(0.05, 0.05, 0.08, accent); tip.position.set(0, 0.03, 0.4); g.add(tip);
      const guard = box(0.14, 0.04, 0.04, accent); guard.position.set(0, 0, 0.03); g.add(guard);
      const handle = box(0.05, 0.05, 0.16, MAT.dark); handle.position.set(0, -0.01, -0.12); g.add(handle);
      muzzle.position.set(0, 0.03, 0.44);
      eject.position.set(0, 0.03, 0.05);
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
    pitch: 0,
    vel: new THREE.Vector3(),
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    vy: 0,
    onGround: true,
    alive: true
  };
  const keys = {};
  let firing = false;

  /* ---------- 英雄 / 货币 / 装备 ---------- */
  const HEROES = {
    assault: { name:'突击手', hp:100, speed:5.2, stamina:100, color:0x2f6f8f, dark:0x1e4d68, healMult:1 },
    tank:    { name:'重装兵', hp:160, speed:4.4, stamina:130, color:0xb0563a, dark:0x7a3a26, healMult:1 },
    scout:   { name:'侦察兵', hp:80, speed:6.6, stamina:110, color:0x3a8f5f, dark:0x286240, healMult:1 },
    medic:   { name:'医疗兵', hp:100, speed:5.2, stamina:100, color:0xe8e8e8, dark:0xb8b8b8, healMult:1.5 }
  };
  let hero = 'assault';
  let coins = 0;
  let medkits = 0;
  let meleeSwing = 0;
  const owned = { pistol:true, smg:false, rifle:false, shotgun:false, sniper:false, lmg:false, melee:true };
  function heroStats() { return HEROES[hero]; }
  function applyHero() {
    const h = HEROES[hero];
    player.maxHp = h.hp;
    player.maxStamina = h.stamina;
    MAT.body.color.setHex(h.color);
    MAT.bodyDark.color.setHex(h.dark);
  }

  /* ---------- 设备 / 输入适配 ---------- */
  // 触屏检测：只在「粗指针/无悬停」的真触屏设备启用触屏，避免 Mac 触控板被误判
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const noHover = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);
  const hasTouch = ('ontouchstart' in window);
  const isTouch = coarse || (hasTouch && noHover) || (hasTouch && !window.matchMedia && navigator.maxTouchPoints > 0);
  document.body.classList.toggle('touch', isTouch);
  const touch = { f: 0, s: 0, sprint: false };   // 虚拟摇杆输入
  let pointerLocked = false;
  let lockSupported = true;
  const lookDrag = { id: null, x: 0, y: 0, moved: 0 };
  let aimTouchId = null, aimLastX = 0, aimLastY = 0;

  // 根节点（含移动/摆头）
  const playerRoot = new THREE.Group();
  playerRoot.position.copy(player.pos);
  playerRoot.visible = false;   // 第一人称：隐藏第三人称身体
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
  let recoilPitch = 0, recoilZ = 0, recoilCam = 0;

  // 生成三把武器并放入挂点
  const gunGroups = {};
  WEAPON_ORDER.forEach(function (type) {
    const g = buildGun(type);
    g.visible = false;
    g.position.set(0, 0.02, 0);
    weaponHolder.add(g);
    gunGroups[type] = g;
  });

  // 第一人称武器（viewmodel，挂在相机上）
  const FPS_BASE = { x: 0.34, y: -0.30, z: -0.55 };
  const fpsRig = new THREE.Group();
  fpsRig.position.set(FPS_BASE.x, FPS_BASE.y, FPS_BASE.z);
  fpsRig.rotation.y = Math.PI;   // 枪模 +Z 朝向相机前向 -Z
  camera.add(fpsRig);
  const fpsGuns = {};
  WEAPON_ORDER.forEach(function (type) {
    const g = buildGun(type);
    g.visible = false;
    fpsRig.add(g);
    fpsGuns[type] = g;
  });

  let currentWeapon = 'pistol';
  let reloading = false;
  let reloadTimer = 0;
  let switchTimer = 0;
  const ammo = { pistol: 12, smg: 40, rifle: 30, shotgun: 6, sniper: 5, lmg: 100, melee: 1 };
  const reserve = { pistol: 60, smg: 240, rifle: 150, shotgun: 36, sniper: 25, lmg: 300, melee: 1 };
  let lastShotAt = -10;
  let viewMode = 'fps';

  function applyView() {
    playerRoot.visible = (viewMode === 'tps');
    fpsRig.visible = (viewMode === 'fps');
    WEAPON_ORDER.forEach(function (t) {
      gunGroups[t].visible = (viewMode === 'tps' && t === currentWeapon);
      fpsGuns[t].visible = (viewMode === 'fps' && t === currentWeapon);
    });
  }
  function setViewMode(m) {
    if (viewMode === m) return;
    viewMode = m;
    applyView();
    const f = document.getElementById('view-fps');
    const t = document.getElementById('view-tps');
    if (f) f.classList.toggle('active', viewMode === 'fps');
    if (t) t.classList.toggle('active', viewMode === 'tps');
  }

  function currentGun() { return (viewMode === 'tps') ? gunGroups[currentWeapon] : fpsGuns[currentWeapon]; }
  function currentCfg() { return WEAPONS[currentWeapon]; }

  function switchWeapon(type) {
    if (!owned[type]) { showBanner('未拥有，请在商店购买'); return; }
    if (type === currentWeapon || switchTimer > 0) return;
    currentWeapon = type;
    reloading = false;
    reloadTimer = 0;
    applyView();
    switchTimer = 0.22;
    updateHudAmmo();
    playSound('switch');
  }
  function cycleWeapon(dir) {
    const ownedList = WEAPON_ORDER.filter(function (t) { return owned[t]; });
    let idx = ownedList.indexOf(currentWeapon);
    if (idx < 0) idx = 0;
    const next = ownedList[(idx + dir + ownedList.length) % ownedList.length];
    switchWeapon(next);
  }

  /* ---------- 敌人 ---------- */
  const enemies = [];
  const ENEMY_TYPES = {
    walker:   { hp: 60, speed: 3.2, damage: 12, scale: 1.0, color: 0xe74c3c, score: 100, name: '突击兵' },
    runner:   { hp: 34, speed: 6.4, damage: 8, scale: 0.78, color: 0xf5a623, score: 150, name: '疾行者' },
    brute:    { hp: 220, speed: 1.9, damage: 26, scale: 1.6, color: 0x9b59b6, score: 300, name: '重装兵' },
    shooter:  { hp: 50, speed: 2.2, damage: 12, scale: 0.9, color: 0x16a085, score: 200, name: '射手', shooter: true },
    exploder: { hp: 40, speed: 5.4, damage: 0, explosion: 35, scale: 0.85, color: 0xff7b00, score: 250, name: '自爆兵', exploder: true },
    flyer:    { hp: 70, speed: 4.6, damage: 10, scale: 0.8, color: 0x3498db, score: 220, name: '飞行兵', flyer: true }
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
      fireCooldown: 1.5,
      exploded: false,
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
    if (wave >= 5 && r < 0.12) return 'flyer';
    if (wave >= 4 && r < 0.26) return 'exploder';
    if (wave >= 3 && r < 0.42) return 'shooter';
    if (wave >= 3 && r < 0.56) return 'brute';
    if (wave >= 2 && r < 0.78) return 'runner';
    return 'walker';
  }

  /* ---------- 掉落物（金币 / 医疗包 / 弹药） ---------- */
  const pickups = [];
  function spawnPickup(pos, type) {
    let mesh;
    if (type === 'coin') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), new THREE.MeshStandardMaterial({ color:0xffd166, roughness:0.3, metalness:0.6, emissive:0x553800, emissiveIntensity:0.4 }));
    } else if (type === 'medkit') {
      const grp = new THREE.Group();
      grp.add(box(0.42, 0.3, 0.42, new THREE.MeshStandardMaterial({ color:0xf2f2f2, roughness:0.5 })));
      grp.add(box(0.2, 0.06, 0.44, new THREE.MeshStandardMaterial({ color:0xff4d5e, roughness:0.4 })));
      grp.add(box(0.06, 0.2, 0.44, new THREE.MeshStandardMaterial({ color:0xff4d5e, roughness:0.4 })));
      mesh = grp;
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), new THREE.MeshStandardMaterial({ color:0x6dff8a, roughness:0.4, metalness:0.2, emissive:0x0a3015, emissiveIntensity:0.5 }));
    }
    mesh.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
    mesh.castShadow = true;
    scene.add(mesh);
    pickups.push({ mesh: mesh, type: type, t: Math.random() * 6 });
  }
  function dropLoot(pos, type) {
    let t = type;
    if (!t) {
      const r = Math.random();
      if (r < 0.5) t = 'coin';
      else if (r < 0.68) t = 'ammo';
      else if (r < 0.82) t = 'medkit';
      else t = null;
    }
    if (t) spawnPickup(pos, t);
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt;
      p.mesh.position.y = 0.5 + Math.sin(p.t * 3) * 0.12;
      p.mesh.rotation.y += dt * 2.5;
      const dx = player.pos.x - p.mesh.position.x;
      const dz = player.pos.z - p.mesh.position.z;
      if (dx * dx + dz * dz < 2.3) {
        collectPickup(p.type);
        scene.remove(p.mesh);
        pickups.splice(i, 1);
      }
    }
  }
  function collectPickup(type) {
    if (type === 'coin') { coins += 50; showBanner('+50 金币'); }
    else if (type === 'medkit') { medkits = Math.min(5, medkits + 1); showBanner('获得医疗包'); }
    else { WEAPON_ORDER.forEach(function (t) { if (owned[t]) reserve[t] = Math.min(999, reserve[t] + WEAPONS[t].mag); }); showBanner('弹药补充'); }
    playSound('pickup');
    updateHud();
    updateShopUI();
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
    } else if (kind === 'melee') {
      blip(300, 0.08, 0.3, 'square', -200);
    } else if (kind === 'meleeHit') {
      blip(140, 0.12, 0.5, 'square', -60); blip(900, 0.05, 0.3, 'triangle');
    } else if (kind === 'pickup') {
      blip(660, 0.06, 0.25, 'triangle', 200); blip(990, 0.08, 0.25, 'triangle', 200);
    } else if (kind === 'buy') {
      blip(520, 0.06, 0.3, 'square', 200); blip(780, 0.08, 0.3, 'square', 200);
    } else if (kind === 'heal') {
      blip(500, 0.12, 0.3, 'sine', 300);
    } else if (kind === 'noMoney') {
      blip(180, 0.12, 0.3, 'square', -60);
    } else if (kind === 'explode') {
      blip(90, 0.3, 0.6, 'sawtooth', -30);
    } else if (kind === 'jump') {
      blip(240, 0.1, 0.2, 'sine', 200);
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

  function meleeAttack() {
    lastShotAt = timeNow;
    meleeSwing = 1;
    const range = 3.0;
    const fwd3 = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    let hitAny = false;
    enemies.forEach(function (e) {
      if (!e.alive || e.dying) return;
      const dx = e.group.position.x - player.pos.x;
      const dz = e.group.position.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < range + e.cfg.scale) {
        const toE = new THREE.Vector3(dx, 0, dz).normalize();
        if (fwd3.angleTo(toE) < 1.0) {
          e.takeDamage(WEAPONS.melee.damage, toE);
          burstSparks(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffe6a0, 6);
          hitAny = true;
        }
      }
    });
    if (hitAny) { hitmark(0); playSound('meleeHit'); } else { playSound('melee'); }
  }

  /* ---------- 敌人子弹 / 自爆 ---------- */
  const enemyBullets = [];
  function fireEnemyBullet(from, to, dmg, color) {
    const dir = to.clone().sub(from).normalize();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: color || 0xff5e5e }));
    mesh.position.copy(from);
    scene.add(mesh);
    enemyBullets.push({ mesh: mesh, vel: dir.multiplyScalar(15), life: 3, dmg: dmg });
  }
  function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      const chest = new THREE.Vector3(player.pos.x, player.pos.y + 1.05, player.pos.z);
      if (b.mesh.position.distanceTo(chest) < 0.7 && player.alive) {
        damagePlayer(b.dmg);
        burstSparks(b.mesh.position, 0xff5e5e, 4);
        scene.remove(b.mesh); enemyBullets.splice(i, 1);
        continue;
      }
      if (b.mesh.position.y <= 0.06 || b.life <= 0) {
        burstSparks(b.mesh.position, 0xff5e5e, 3);
        scene.remove(b.mesh); enemyBullets.splice(i, 1);
      }
    }
  }
  function explodeEnemy(e) {
    if (!e.alive || e.exploded) return;
    e.exploded = true;
    e.dying = true;
    e.hbBack.visible = false; e.hbFront.visible = false;
    const dx = player.pos.x - e.group.position.x;
    const dz = player.pos.z - e.group.position.z;
    if (dx * dx + dz * dz < 11.6 && player.alive) damagePlayer(e.cfg.explosion);
    burstSparks(e.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff7b00, 22);
    shake += 0.9;
    playSound('explode');
    score += e.cfg.score; kills += 1; coins += Math.round(e.cfg.score / 2);
    dropLoot(e.group.position.clone(), 'coin');
  }

  function tryFire() {
    const cfg = currentCfg();
    if (!player.alive || reloading || switchTimer > 0) return;
    if (timeNow - lastShotAt < cfg.interval) return;
    if (currentWeapon === 'melee') { meleeAttack(); return; }
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
    recoilCam += cfg.kick * 0.10;
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
  function playerObstaclePush() {
    obstacles.forEach(function (o) {
      if (player.pos.y >= o.h - 0.05) return;                    // 站在顶部，不推
      if (player.vy > 0 && (o.h - player.pos.y) < 2.0) return;   // 向上跳向可达的顶，放行
      const cx = Math.max(o.x - o.hw, Math.min(player.pos.x, o.x + o.hw));
      const cz = Math.max(o.z - o.hd, Math.min(player.pos.z, o.z + o.hd));
      let dx = player.pos.x - cx, dz = player.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < PLAYER_R * PLAYER_R) {
        let d = Math.sqrt(d2);
        if (d < 0.001) { dx = 0; dz = 1; d = 1; }
        const push = (PLAYER_R - d) / d;
        player.pos.x += dx * push;
        player.pos.z += dz * push;
      }
    });
  }

  /* ---------- 屏幕震动 ---------- */
  let shake = 0;

  /* ---------- 计分 HUD ---------- */
  function updateHudAmmo() {
    const cfg = currentCfg();
    weaponNameEl.textContent = cfg.name;
    if (cfg.melee) {
      ammoEl.innerHTML = '∞ <small>近战</small>';
    } else {
      ammoEl.innerHTML = ammo[currentWeapon] + ' <small>/ ' + reserve[currentWeapon] + '</small>';
    }
  }
  function updateHud() {
    hpBar.style.width = Math.max(0, Math.round(player.hp / player.maxHp * 100)) + '%';
    stBar.style.width = Math.max(0, Math.round(player.stamina / player.maxStamina * 100)) + '%';
    scoreEl.textContent = score;
    waveEl.textContent = Math.max(1, wave);
    killsEl.textContent = kills;
    const coinEl = document.getElementById('coins');
    if (coinEl) coinEl.textContent = coins;
    const medEl = document.getElementById('medkits');
    if (medEl) medEl.textContent = medkits;
  }

  /* ---------- 游戏状态 ---------- */
  let gameStarted = false;
  let running = false;
  let timeNow = 0;

  function startGame() {
    score = 0; kills = 0;
    applyHero();
    player.hp = player.maxHp; player.stamina = player.maxStamina; player.alive = true;
    player.pos.set(0, 0, 0); player.vel.set(0, 0, 0); player.yaw = 0; player.pitch = 0;
    enemies.forEach(function (e) { scene.remove(e.group); scene.remove(e.hbBack); scene.remove(e.hbFront); });
    enemies.length = 0;
    WEAPON_ORDER.forEach(function (t) { ammo[t] = WEAPONS[t].mag; reserve[t] = WEAPONS[t].reserve; });
    reloading = false; reloadTimer = 0; switchTimer = 0;
    dodgeT = 0; dodgeCd = 0; shake = 0;
    coins = 0; medkits = 0; meleeSwing = 0;
    owned.pistol = true; owned.smg = false; owned.rifle = false; owned.shotgun = false; owned.sniper = false; owned.lmg = false; owned.melee = true;
    currentWeapon = 'pistol';
    applyView();
    startWave(1);
    updateHudAmmo();
    updateHud();
    updateShopUI();
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

  /* ---------- 输入（键盘 + 鼠标/触摸，兼容指针锁定失败） ---------- */
  function setLook(dx, dy) {
    player.yaw -= dx * 0.0024;
    player.pitch -= dy * 0.0024;
    player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
  }

  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'KeyR') startReload();
    if (e.code === 'Digit1') switchWeapon('pistol');
    if (e.code === 'Digit2') switchWeapon('smg');
    if (e.code === 'Digit3') switchWeapon('rifle');
    if (e.code === 'Digit4') switchWeapon('shotgun');
    if (e.code === 'Digit5') switchWeapon('sniper');
    if (e.code === 'Digit6') switchWeapon('lmg');
    if (e.code === 'Digit7') switchWeapon('melee');
    if (e.code === 'KeyQ') cycleWeapon(1);
    if (e.code === 'KeyH') heal();
    if (e.code === 'KeyB') toggleShop();
    if (e.code === 'Space') { e.preventDefault(); jump(); }
    if (e.code === 'KeyC') tryDodge();
    if (e.code === 'Escape') { e.preventDefault(); togglePause(); }
  });
  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  // 鼠标：锁定状态下用移动增量；未锁定（Safari/iframe 失败）用拖拽瞄准 + 按住射击
  window.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (!gameStarted || !running || !player.alive) return;
    if (pointerLocked) {
      firing = true;
      if (!currentCfg().auto) tryFire();
    } else if (!isTouch) {
      lookDrag.id = 1;
      lookDrag.x = e.clientX;
      lookDrag.y = e.clientY;
      lookDrag.moved = 0;
      firing = true;
      if (!currentCfg().auto) tryFire();
    }
  });
  window.addEventListener('mousemove', function (e) {
    if (!running || !player.alive) return;
    if (pointerLocked) {
      setLook(e.movementX || 0, e.movementY || 0);
    } else if (!isTouch && lookDrag.id) {
      const dx = e.clientX - lookDrag.x;
      const dy = e.clientY - lookDrag.y;
      lookDrag.moved += Math.abs(dx) + Math.abs(dy);
      if (lookDrag.moved > 6) { firing = false; setLook(dx, dy); }
      lookDrag.x = e.clientX; lookDrag.y = e.clientY;
    }
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button !== 0) return;
    if (pointerLocked || !isTouch) firing = false;
    if (!isTouch) lookDrag.id = null;
  });
  window.addEventListener('wheel', function (e) {
    if (!running) return;
    if (Math.abs(e.deltaY) > 5) cycleWeapon(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  /* ---------- 触摸控制（iOS / Android） ---------- */
  const joyBase = document.getElementById('joystick');
  const joyKnob = document.getElementById('joystick-knob');
  const aimZone = document.getElementById('aim-zone');
  const fireBtn = document.getElementById('fire-btn');
  let joyId = null, joyCenterX = 0, joyCenterY = 0;
  const JOY_R = 56;

  function joyMove(x, y) {
    let dx = x - joyCenterX, dy = y - joyCenterY;
    const len = Math.hypot(dx, dy) || 1;
    if (len > JOY_R) { dx = dx / len * JOY_R; dy = dy / len * JOY_R; }
    joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    touch.f = -dy / JOY_R;
    touch.s = dx / JOY_R;
  }
  function joyReset() {
    if (joyKnob) joyKnob.style.transform = 'translate(0px,0px)';
    touch.f = 0; touch.s = 0; joyId = null;
  }
  if (joyBase) {
    joyBase.addEventListener('touchstart', function (e) {
      e.preventDefault();
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = joyBase.getBoundingClientRect();
      joyCenterX = r.left + r.width / 2;
      joyCenterY = r.top + r.height / 2;
      joyMove(t.clientX, t.clientY);
    }, { passive: false });
    joyBase.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joyId) joyMove(t.clientX, t.clientY);
      }
    }, { passive: false });
    joyBase.addEventListener('touchend', function (e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) joyReset();
      }
    });
    joyBase.addEventListener('touchcancel', joyReset);
  }

  if (aimZone) {
    aimZone.addEventListener('touchstart', function (e) {
      e.preventDefault();
      const t = e.changedTouches[0];
      aimTouchId = t.identifier;
      aimLastX = t.clientX; aimLastY = t.clientY;
    }, { passive: false });
    aimZone.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === aimTouchId) {
          setLook(t.clientX - aimLastX, t.clientY - aimLastY);
          aimLastX = t.clientX; aimLastY = t.clientY;
        }
      }
    }, { passive: false });
    aimZone.addEventListener('touchend', function (e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === aimTouchId) aimTouchId = null;
      }
    });
  }

  if (fireBtn) {
    fireBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (!gameStarted || !running || !player.alive) return;
      firing = true;
      if (!currentCfg().auto) tryFire();
    }, { passive: false });
    fireBtn.addEventListener('touchend', function (e) { e.preventDefault(); firing = false; }, { passive: false });
    fireBtn.addEventListener('touchcancel', function () { firing = false; });
  }

  function bindBtn(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', function (e) { e.preventDefault(); fn(); }, { passive: false });
  }
  bindBtn('btn-weapon', function () { cycleWeapon(1); });
  bindBtn('btn-reload', function () { startReload(); });
  bindBtn('btn-dodge', function () { tryDodge(); });
  bindBtn('btn-pause', function () { togglePause(); });
  bindBtn('btn-sprint', function () { touch.sprint = true; });
  bindBtn('btn-heal', function () { heal(); });
  bindBtn('btn-shop', function () { toggleShop(); });
  bindBtn('btn-jump', function () { jump(); });
  const sprintBtn = document.getElementById('btn-sprint');
  if (sprintBtn) {
    sprintBtn.addEventListener('touchend', function () { touch.sprint = false; });
    sprintBtn.addEventListener('touchcancel', function () { touch.sprint = false; });
  }

  // 跳跃 / 翻滚
  let dodgeT = 0, dodgeCd = 0;
  function jump() {
    if (!running || !player.alive || !player.onGround) return;
    player.vy = 9.0;
    player.onGround = false;
    playSound('jump');
  }
  function tryDodge() {
    if (!running || !player.alive) return;
    if (dodgeT > 0 || dodgeCd > 0 || player.stamina < 20) return;
    player.stamina -= 20;
    dodgeT = 0.38;
    dodgeCd = 0.9;
    const dir = moveDir.clone();
    if (dir.lengthSq() < 0.001) dir.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    dir.normalize();
    player.vel.addScaledVector(dir, 14);
    dustPuff(player.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 10, true);
  }

  /* ---------- 暂停 / 指针锁定 / 全屏 ---------- */
  function requestLock() {
    if (isTouch || !lockSupported) return;
    try {
      const p = canvas.requestPointerLock && canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () { lockSupported = false; });
    } catch (err) { lockSupported = false; }
  }
  function enterFullscreen() {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (err) {}
  }
  function pauseGame() {
    if (!gameStarted || !player.alive) return;
    running = false;
    firing = false;
    pauseOverlay.classList.remove('hidden');
  }
  function resumeGame() {
    if (!gameStarted || !player.alive) return;
    running = true;
    pauseOverlay.classList.add('hidden');
    if (!isTouch) requestLock();
  }
  function togglePause() {
    if (running) pauseGame(); else resumeGame();
  }

  /* ---------- 医疗包 / 商店 ---------- */
  function heal() {
    if (!player.alive || player.hp >= player.maxHp) return;
    if (medkits <= 0) { showBanner('没有医疗包'); return; }
    medkits--;
    player.hp = Math.min(player.maxHp, player.hp + 50 * heroStats().healMult);
    playSound('heal');
    updateHud();
    updateShopUI();
  }
  let shopOpen = false;
  function toggleShop() {
    if (!gameStarted || !player.alive) return;
    const shop = document.getElementById('shop-overlay');
    if (!shop) return;
    shopOpen = !shopOpen;
    if (shopOpen) {
      running = false; firing = false;
      shop.classList.remove('hidden');
      updateShopUI();
    } else {
      shop.classList.add('hidden');
      running = true;
      if (!isTouch) requestLock();
    }
  }
  function buyWeapon(type) {
    const price = WEAPONS[type].price;
    if (owned[type]) return;
    if (coins < price) { playSound('noMoney'); showBanner('金币不足'); return; }
    coins -= price;
    owned[type] = true;
    playSound('buy');
    updateShopUI();
    updateHud();
  }
  function buyMedkit() {
    if (coins < 150) { playSound('noMoney'); showBanner('金币不足'); return; }
    if (medkits >= 5) { showBanner('医疗包已满'); return; }
    coins -= 150;
    medkits++;
    playSound('buy');
    updateShopUI();
    updateHud();
  }
  function updateShopUI() {
    const c = document.getElementById('shop-coins');
    if (c) c.textContent = coins;
    const m = document.getElementById('shop-medkits');
    if (m) m.textContent = medkits;
    WEAPON_ORDER.forEach(function (t) {
      if (t === 'pistol' || t === 'melee') return;
      const btn = document.getElementById('buy-' + t);
      if (!btn) return;
      if (owned[t]) { btn.textContent = '已拥有'; btn.disabled = true; }
      else { btn.textContent = '购买 ' + WEAPONS[t].price + ' 金币'; btn.disabled = false; }
    });
    const mb = document.getElementById('buy-medkit');
    if (mb) mb.textContent = '医疗包 150 金币（拥有 ' + medkits + '）';
  }

  document.addEventListener('pointerlockchange', function () {
    pointerLocked = (document.pointerLockElement === canvas || document.webkitPointerLockElement === canvas);
    if (pointerLocked && gameStarted && player.alive) {
      running = true;
      pauseOverlay.classList.add('hidden');
    }
  });

  startBtn.addEventListener('click', function () {
    ensureAudio();
    startGame();
    running = true;
    pauseOverlay.classList.add('hidden');
    if (isTouch) enterFullscreen(); else requestLock();
  });
  resumeBtn.addEventListener('click', function () {
    ensureAudio();
    resumeGame();
  });
  restartBtn.addEventListener('click', function () {
    ensureAudio();
    startGame();
    running = true;
    if (isTouch) enterFullscreen(); else requestLock();
  });
  const viewFpsBtn = document.getElementById('view-fps');
  const viewTpsBtn = document.getElementById('view-tps');
  if (viewFpsBtn) viewFpsBtn.addEventListener('click', function () { setViewMode('fps'); });
  if (viewTpsBtn) viewTpsBtn.addEventListener('click', function () { setViewMode('tps'); });
  WEAPON_ORDER.forEach(function (t) {
    if (t === 'pistol' || t === 'melee') return;
    const btn = document.getElementById('buy-' + t);
    if (btn) btn.addEventListener('click', function () { buyWeapon(t); });
  });
  const buyMedBtn = document.getElementById('buy-medkit');
  if (buyMedBtn) buyMedBtn.addEventListener('click', buyMedkit);
  const shopCloseBtn = document.getElementById('shop-close');
  if (shopCloseBtn) shopCloseBtn.addEventListener('click', function () { toggleShop(); });
  document.querySelectorAll('#hero-row .hero-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      hero = b.getAttribute('data-hero');
      applyHero();
      document.querySelectorAll('#hero-row .hero-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
    });
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

    updateCamera(dt);
    if (running && player.alive) {
      updatePlayer(dt);
      updateEnemies(dt);
      updateWaves(dt);
    }
    updateParticles(dt);
    updateTracers(dt);
    updateFlashes(dt);
    updatePickups(dt);
    updateEnemyBullets(dt);
    // 受击红幕淡出
    const vop = parseFloat(vignetteEl.style.opacity || '0');
    if (vop > 0) vignetteEl.style.opacity = Math.max(0, vop - dt * 2.2).toFixed(3);
    updateHud();
    renderer.render(scene, camera);
  }

  function updatePlayer(dt) {
    if (!player.alive) return;

    // 体力恢复
    const sprinting = keys['ShiftLeft'] || keys['ShiftRight'] || touch.sprint;
    if (!sprinting && dodgeT <= 0) player.stamina = Math.min(player.maxStamina, player.stamina + 16 * dt);

    // 输入方向（键盘 + 触摸摇杆）
    let f = touch.f, s = touch.s;
    if (keys['KeyW'] || keys['ArrowUp']) f += 1;
    if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) s += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) s -= 1;
    f = Math.max(-1, Math.min(1, f));
    s = Math.max(-1, Math.min(1, s));

    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    moveDir.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, s);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const canSprint = sprinting && f > 0 && player.stamina > 0;
    let speed = heroStats().speed;
    if (canSprint) { speed = heroStats().speed * 1.65; player.stamina = Math.max(0, player.stamina - 22 * dt); }

    // 加速度 / 摩擦
    const target = moveDir.clone().multiplyScalar(speed);
    const accel = moveDir.lengthSq() > 0 ? 40 : 26;
    player.vel.x += (target.x - player.vel.x) * Math.min(1, accel * dt);
    player.vel.z += (target.z - player.vel.z) * Math.min(1, accel * dt);
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.z * dt;

    // 重力与垂直移动
    const prevY = player.pos.y;
    if (player.onGround) player.vy = 0;
    player.vy -= 20 * dt;
    player.pos.y += player.vy * dt;
    player.onGround = false;
    if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; player.onGround = true; }
    if (player.pos.y > 0) {
      obstacles.forEach(function (o) {
        if (player.pos.x > o.x - o.hw && player.pos.x < o.x + o.hw && player.pos.z > o.z - o.hd && player.pos.z < o.z + o.hd) {
          if (prevY >= o.h - 0.2 && player.pos.y <= o.h) { player.pos.y = o.h; player.vy = 0; player.onGround = true; }
        }
      });
    }

    // 翻滚计时
    if (dodgeT > 0) dodgeT -= dt;
    if (dodgeCd > 0) dodgeCd -= dt;

    // 边界与障碍碰撞
    const b = BOUND;
    player.pos.x = Math.max(-b, Math.min(b, player.pos.x));
    player.pos.z = Math.max(-b, Math.min(b, player.pos.z));
    playerObstaclePush();

    playerRoot.position.copy(player.pos);

    // 移动动画
    const speedRatio = Math.min(1, Math.hypot(player.vel.x, player.vel.z) / speed);
    const moving = speedRatio > 0.05;
    if (moving) bobT += dt * (canSprint ? 13 : 9.5);
    const swing = moving ? speedRatio : 0;
    const amp = 0.7 * swing;

    playerRoot.position.y = player.pos.y + Math.abs(Math.sin(bobT)) * 0.09 * swing;
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
      playerRoot.position.y = player.pos.y + 0.25;
    }

    // 面向移动/射击方向（第三人称时身体背对相机）
    bodyNode.rotation.y = player.yaw + (viewMode === 'tps' ? Math.PI : 0);

    // 武器后坐回弹（按视角作用到对应枪）
    recoilPitch += (0 - recoilPitch) * Math.min(1, 12 * dt);
    recoilZ += (0 - recoilZ) * Math.min(1, 12 * dt);
    recoilCam += (0 - recoilCam) * Math.min(1, 14 * dt);
    meleeSwing = Math.max(0, meleeSwing - dt * 5);
    if (viewMode === 'tps') {
      weaponHolder.rotation.x = player.pitch + recoilPitch;
      weaponHolder.position.z = WEAPON_BASE.z - recoilZ;
      if (currentWeapon === 'melee') armR.pivot.rotation.x = -meleeSwing * 1.3;
    } else {
      fpsRig.rotation.x = recoilPitch + Math.sin(bobT) * 0.03 * swing;
      fpsRig.position.z = FPS_BASE.z + recoilZ;
      fpsRig.position.x = FPS_BASE.x + Math.cos(bobT * 0.5) * 0.03 * swing;
      fpsRig.position.y = FPS_BASE.y + Math.sin(bobT) * 0.03 * swing;
      fpsRig.rotation.z = (currentWeapon === 'melee' ? -meleeSwing * 0.8 : 0);
    }

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

      // 朝向玩家并移动（按类型）
      const toP = new THREE.Vector3(player.pos.x - e.group.position.x, 0, player.pos.z - e.group.position.z);
      const dist = toP.length();
      if (dist > 0.001) toP.normalize();
      e.group.rotation.y = (dist > 0.001) ? Math.atan2(toP.x, toP.z) : e.group.rotation.y;

      if (e.cfg.flyer) {
        e.group.position.y = 1.4 + Math.sin(e.walkPhase) * 0.25;
        if (dist > 1.0) e.group.position.addScaledVector(toP, e.cfg.speed * dt);
      } else if (e.cfg.shooter) {
        if (dist > 15) e.group.position.addScaledVector(toP, e.cfg.speed * dt);
        else if (dist < 7) e.group.position.addScaledVector(toP, -e.cfg.speed * dt);
      } else if (e.cfg.exploder) {
        if (dist > 0.8) e.group.position.addScaledVector(toP, e.cfg.speed * dt);
      } else {
        if (dist > 1.0) e.group.position.addScaledVector(toP, e.cfg.speed * dt);
      }

      // 障碍碰撞（飞行兵不撞）
      if (!e.cfg.flyer) {
        const p2 = e.group.position;
        pushOutOfObstacles(p2, 0.5 * e.cfg.scale);
      }

      // 射手远程射击
      if (e.cfg.shooter) {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 22 && player.alive) {
          e.fireCooldown = 2.0;
          fireEnemyBullet(
            e.group.position.clone().add(new THREE.Vector3(0, 1.1, 0)),
            new THREE.Vector3(player.pos.x, player.pos.y + 1.05, player.pos.z),
            e.cfg.damage, 0xff5e5e
          );
        }
      }

      // 自爆兵接近后爆炸
      if (e.cfg.exploder && dist < 2.4 && player.alive) { explodeEnemy(e); continue; }

      // 近战攻击（地面怪无法打到高地；飞行兵俯冲可命中）
      const canMelee = !e.cfg.shooter && !e.cfg.exploder && (e.cfg.flyer ? (dist < 1.2 * e.cfg.scale) : (dist < 1.2 * e.cfg.scale && Math.abs(e.group.position.y - player.pos.y) < 1.3));
      if (canMelee && e.attackCooldown <= 0 && player.alive) {
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
      coins += Math.round(this.cfg.score / 2);
      hitmark(1);
      playSound('kill');
      burstSparks(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)), this.cfg.color, 14);
      const p = this.group.position.clone();
      if (this.type === 'brute') dropLoot(p, Math.random() < 0.5 ? 'medkit' : 'ammo');
      else dropLoot(p, null);
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

  /* ---------- 相机（第一/第三人称可切换） ---------- */
  const EYE_HEIGHT = 1.62;

  function updateCamera(dt) {
    if (viewMode === 'tps') {
      const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
      camera.position.set(
        player.pos.x + Math.sin(player.yaw) * cp * CAM_DIST,
        player.pos.y + 1.55 + sp * CAM_DIST,
        player.pos.z + Math.cos(player.yaw) * cp * CAM_DIST
      );
      camera.lookAt(
        player.pos.x - Math.sin(player.yaw) * cp * 30,
        player.pos.y + 1.55 + sp * 30,
        player.pos.z - Math.cos(player.yaw) * cp * 30
      );
    } else {
      camera.position.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch + recoilCam;
      camera.rotation.z = 0;
    }

    // 屏幕震动
    if (shake > 0.001) {
      shake = Math.max(0, shake - dt * 6);
      const amp = shake * 0.12;
      camera.position.x += (Math.random() - 0.5) * amp;
      camera.position.y += (Math.random() - 0.5) * amp;
      camera.position.z += (Math.random() - 0.5) * amp;
    }

    camera.updateMatrixWorld(true);
  }

  /* ---------- 启动渲染循环 ---------- */
  // 初始：第一人称，显示步枪
  applyView();
  updateHudAmmo();
  updateHud();
  animate();
})();
