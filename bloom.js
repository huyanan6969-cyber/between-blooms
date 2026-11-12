const canvas = document.querySelector('#flower');
const context = canvas.getContext('2d');
const size = canvas.width;
const mask = document.createElement('canvas');
mask.width = mask.height = size;
const paint = mask.getContext('2d', { willReadFrequently: true });
const color = document.createElement('canvas');
color.width = color.height = size;
const layer = color.getContext('2d');
const viewSlider = document.querySelector('#view');
const openingSlider = document.querySelector('#opening');
const stage = document.querySelector('#stage');
const ring = document.querySelector('#ring');
const progress = document.querySelector('#progress');
const percent = document.querySelector('#percent');
const recovery = document.querySelector('#recovery');
const camera = document.querySelector('#camera');
const video = document.querySelector('#video');
const handOverlay = document.querySelector('#hand-overlay');
const overlay = handOverlay.getContext('2d');
const palmMarker = document.querySelector('#palm');
const status = document.querySelector('#status');
let dirty = true;
let complete = false;
let openness = .001;
let target = .35;
let previous;
let keyPosition = { x: size / 2, y: size / 2 };
let stream;
let detector;
let openGesture = false;
const fingers = [[0,1,2,3,4], [0,5,6,7,8], [5,9,10,11,12], [9,13,14,15,16], [13,17,18,19,20], [17,0]];
const handFrame = document.createElement('canvas');
const handFrameContext = handFrame.getContext('2d', { willReadFrequently: true });
let library;
let cameraSession = 0;

function frame() {
  if (dirty || Math.abs(target - openness) > .002) {
    dirty = false;
    openness += (target - openness) * .24;
    const view = viewSlider.valueAsNumber * Math.PI / 180;
    context.clearRect(0, 0, size, size);
    drawBloom(context, openness, view, !complete);
    if (!complete) {
      layer.clearRect(0, 0, size, size);
      drawBloom(layer, openness, view);
      layer.globalCompositeOperation = 'destination-in';
      layer.drawImage(mask, 0, 0);
      layer.globalCompositeOperation = 'source-over';
      context.drawImage(color, 0, 0);
    }
  }
  requestAnimationFrame(frame);
}

function sweep(x, y, active = true) {
  dirty = true;
  const radius = active ? 68 : 25;
  const box = canvas.getBoundingClientRect();
  const edge = Math.min(box.width, box.height);
  ring.hidden = complete && !stream;
  ring.style.left = ((box.width - edge) / 2 + x * edge / size) + 'px';
  ring.style.top = ((box.height - edge) / 2 + y * edge / size) + 'px';
  ring.style.width = ring.style.height = (radius * 2 * edge / size) + 'px';
  if (!active || complete) {
    previous = undefined;
    return;
  }
  const start = previous || { x, y };
  const steps = Math.max(1, Math.ceil(Math.hypot(x - start.x, y - start.y) / 25));
  for (let i = 1; i <= steps; i++) {
    const px = start.x + (x - start.x) * i / steps;
    const py = start.y + (y - start.y) * i / steps;
    const glow = paint.createRadialGradient(px, py, radius * .48, px, py, radius);
    glow.addColorStop(0, '#fff');
    glow.addColorStop(1, '#ffffff00');
    paint.fillStyle = glow;
    paint.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }
  previous = { x, y };
  const pixels = paint.getImageData(185, 145, 270, 240).data;
  let lit = 0;
  for (let i = 3; i < pixels.length; i += 4) lit += pixels[i] > 160;
  const value = Math.min(100, Math.floor(lit / (270 * 240 * .62) * 100));
  progress.value = value;
  percent.value = value + '%';
  if (value === 100) {
    complete = true;
    target = 1;
    openingSlider.value = 100;
    ring.hidden = true;
    recovery.hidden = false;
  }
}

function pointer(event) {
  const box = canvas.getBoundingClientRect();
  const edge = Math.min(box.width, box.height);
  sweep((event.clientX - box.left - (box.width - edge) / 2) * size / edge,
    (event.clientY - box.top - (box.height - edge) / 2) * size / edge);
}

function clearPointer() {
  previous = undefined;
  ring.hidden = true;
}

stage.addEventListener('pointerdown', event => {
  stage.setPointerCapture(event.pointerId);
  pointer(event);
});
stage.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse' || stage.hasPointerCapture(event.pointerId)) pointer(event);
});
for (const event of ['pointerleave', 'pointerup', 'pointercancel']) {
  stage.addEventListener(event, clearPointer);
}
stage.addEventListener('keydown', event => {
  const delta = { ArrowLeft: [-48, 0], ArrowRight: [48, 0], ArrowUp: [0, -48], ArrowDown: [0, 48], ' ': [0, 0] }[event.key];
  if (!delta) return;
  event.preventDefault();
  keyPosition.x = Math.max(0, Math.min(size, keyPosition.x + delta[0]));
  keyPosition.y = Math.max(0, Math.min(size, keyPosition.y + delta[1]));
  sweep(keyPosition.x, keyPosition.y);
});
viewSlider.addEventListener('input', () => { dirty = true; });
openingSlider.value = 35;
openingSlider.addEventListener('input', () => { target = openingSlider.valueAsNumber / 100; });
document.querySelector('#reset').addEventListener('click', () => {
  complete = false;
  dirty = true;
  target = 0;
  openingSlider.value = 0;
  clearPointer();
  paint.clearRect(0, 0, size, size);
  progress.value = 0;
  percent.value = '0%';
  recovery.hidden = true;
});

function drawHand(points) {
  if (handOverlay.width !== handFrame.width || handOverlay.height !== handFrame.height) {
    handOverlay.width = handFrame.width;
    handOverlay.height = handFrame.height;
  }
  overlay.clearRect(0, 0, handOverlay.width, handOverlay.height);
  handOverlay.hidden = !points;
  if (!points) return;

  overlay.strokeStyle = '#68fff2';
  overlay.lineWidth = 2.4;
  overlay.lineJoin = 'round';
  overlay.lineCap = 'round';
  overlay.shadowColor = '#13e6f2';
  overlay.shadowBlur = 7;
  for (const finger of fingers) {
    overlay.beginPath();
    finger.forEach((index, joint) => {
      const { x, y } = points[index];
      const mirroredX = handOverlay.width - x;
      if (joint === 0) overlay.moveTo(mirroredX, y);
      else overlay.lineTo(mirroredX, y);
    });
    overlay.stroke();
  }
  for (const [index, {x, y}] of points.entries()) {
    overlay.beginPath();
    overlay.arc(handOverlay.width - x, y, [4,8,12,16,20].includes(index) ? 4.2 : 2.6, 0, Math.PI * 2);
    overlay.fillStyle = '#e5fffc';
    overlay.fill();
  }
}

function track(hands) {
  if (!stream) return;
  const points = hands?.[0]?.keypoints;
  if (points?.length < 21 || !points || !video.videoWidth || !video.videoHeight) {
    drawHand();
    openGesture = false;
    palmMarker.hidden = true;
    clearPointer();
    status.textContent = '摄像头已开启，等待手掌进入画面。';
    return;
  }
  const distance = (a, b) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
  const palm = Math.max(distance(0, 9), 1);
  const spread = [8, 12, 16, 20].reduce((sum, tip) => sum + distance(0, tip), 0) / (4 * palm);
  const opening = Math.max(0, Math.min(1, (spread - 1.02) / .63));
  drawHand(points);
  openGesture = opening > (openGesture ? .24 : .34);
  target = opening;
  openingSlider.value = Math.round(opening * 100);
  status.textContent = openGesture ? '已识别：张开的手掌' : '已识别：合拢的手掌';
  const x = (points[0].x + points[9].x) / 2;
  const y = (points[0].y + points[9].y) / 2;
  const mirroredX = 1 - x / handFrame.width;
  const normalizedY = y / handFrame.height;
  palmMarker.style.left = `${mirroredX * 100}%`;
  palmMarker.style.top = `${normalizedY * 100}%`;
  palmMarker.hidden = false;
  sweep(size * mirroredX, size * normalizedY, openGesture);
}

function stopCamera() {
  cameraSession++;
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  video.srcObject = null;
  video.hidden = true;
  drawHand();
  openGesture = false;
  palmMarker.hidden = true;
  camera.textContent = '开启摄像头';
  camera.setAttribute('aria-pressed', 'false');
  clearPointer();
}

function loadLibrary() {
  library ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/ml5@1/dist/ml5.min.js';
    script.onload = resolve;
    script.onerror = () => { library = undefined; script.remove(); reject(new Error('无法加载 ml5.js，请检查网络连接。')); };
    document.head.append(script);
  });
  return library;
}

async function startDetector() {
  await loadLibrary();
  handFrame.width = 320;
  handFrame.height = Math.max(1, Math.round(320 * video.videoHeight / video.videoWidth));
  handFrameContext.drawImage(video, 0, 0, handFrame.width, handFrame.height);
  const failures = [];
  for (const runtime of ['tfjs', 'mediapipe']) {
    try {
      // Some ml5 releases return a Promise; others expose readiness on the instance.
      const candidate = await ml5.handPose({
        maxHands: 1,
        modelType: 'lite',
        runtime,
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240'
      });
      await candidate.ready;
      const hands = await candidate.detect(handFrame);
      detector = candidate;
      return hands;
    } catch (error) {
      failures.push(`${runtime}: ${error.message || error}`);
    }
  }
  throw new Error(failures.join(' · '));
}

async function detectHands(session) {
  let lastTime = -1;
  while (session === cameraSession) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (session !== cameraSession) return;
    if (video.readyState < 2 || video.currentTime === lastTime) continue;
    lastTime = video.currentTime;
    handFrameContext.drawImage(video, 0, 0, handFrame.width, handFrame.height);
    const hands = await detector.detect(handFrame);
    if (session === cameraSession) track(hands);
  }
}

camera.addEventListener('click', async () => {
  if (stream) {
    stopCamera();
    status.textContent = '';
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = '当前页面无法访问摄像头。请在 Chrome 或 Safari 中打开 HTTPS 网页，或通过 localhost 访问。';
    return;
  }
  const session = ++cameraSession;
  camera.disabled = true;
  status.textContent = '正在启动手势识别…';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    if (session !== cameraSession) {
      stream.getTracks().forEach(track => track.stop());
      stream = undefined;
      return;
    }
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    status.textContent = '摄像头已开启，正在加载手势模型…';
    const firstHands = await startDetector();
    if (session !== cameraSession) return;
    camera.textContent = '关闭摄像头';
    camera.setAttribute('aria-pressed', 'true');
    track(firstHands);
    detectHands(session).catch(error => {
      if (session !== cameraSession) return;
      console.error('Hand tracking failed', error);
      stopCamera();
      status.textContent = '手势检测中断。' + (error.message || error);
    });
  } catch (error) {
    const cameraOpened = Boolean(stream);
    stopCamera();
    status.textContent = cameraOpened ? '摄像头已连接，但手势模型未能启动。' + (error.message || error) :
      error.name === 'NotAllowedError' ? '摄像头权限被拒绝。请在浏览器网站设置中允许访问后重试。' :
      '无法打开摄像头，请检查设备连接或关闭占用摄像头的应用。';
  } finally {
    camera.disabled = false;
  }
});
window.addEventListener('pagehide', stopCamera);
requestAnimationFrame(frame);
