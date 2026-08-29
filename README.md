# 火力前线 · 3D 射击生存游戏

基于 Three.js 的第三人称 3D 射击生存小游戏，纯静态 HTML/JS，双击即可玩。

## 玩法

- 波次生存：击杀不断刷新的敌人，波数越高敌人越强越多
- 三种敌人：突击兵（红）、疾行者（橙/快）、重装兵（紫/肉），带血条与死亡动画
- 三把武器：手枪 / 突击步枪 / 霰弹枪，伤害、射速、散布、弹匣各不相同
- 人物动画：走路摆臂摆腿、冲刺前倾、翻滚闪避、后坐回弹、扬尘粒子
- 视觉特效：枪口火光、弹道拖尾、抛壳、命中火花、屏幕震动、受击红幕、WebAudio 合成音效

## 操作

| 按键 | 功能 |
| --- | --- |
| W A S D | 移动 |
| 鼠标 | 视角 / 瞄准 |
| 鼠标左键 | 射击（步枪可按住连发） |
| 1 / 2 / 3 / Q / 滚轮 | 切换武器 |
| R | 换弹 |
| Shift | 冲刺 |
| 空格 | 翻滚闪避 |
| Esc | 暂停 |

## 本地运行

直接双击 `index.html`，或用任意静态服务器：

    cd shooting-game && python3 -m http.server 8080

然后浏览器打开 http://localhost:8080 。

## 文件结构

    shooting-game/
    ├── index.html           入口 + HUD/界面
    ├── game.js              游戏逻辑（Three.js）
    ├── vendor/three.min.js  本地化 Three.js r160（离线可玩）
    └── Dockerfile           busybox httpd 部署镜像

## Docker 部署

    docker build -t shooting:latest .
    docker run -d --name shooting --restart unless-stopped -p 8080:8080 shooting:latest

配合 nginx 反代到某个子路径（如 /shooting/）即可与其它站点共存，详见部署 skill。

## 在线试玩

https://156.225.21.165/shooting/
