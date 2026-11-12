// Each petal is a curved surface in three dimensions. Project and depth-sort its patches.
function drawBloom(ctx, opening, view, gray = false) {
  const patches = [];
  const turn = Math.cos(view);
  const tilt = Math.sin(view);
  function project(x, y, z) {
    const horizontal = x * turn + z * tilt;
    const depth = z * turn - x * tilt;
    const vertical = y * .82 - depth * .57;
    const cameraDepth = depth * .82 + y * .57;
    const perspective = 820 / (820 - cameraDepth);
    return [320 + horizontal * perspective, 375 - vertical * perspective, cameraDepth];
  }

  for (let row = 0; row < 4; row++) {
    const count = 7 + row * 3;
    for (let index = 0; index < count; index++) {
      const angle = (index / count + row * .071) * Math.PI * 2;
      const length = 124 + row * 34 + 13 * Math.sin(index * 7 + row);
      const spread = (.19 + row * .035) + opening * (.29 + row * .13);
      const width = 32 + row * 9;
      function point(t, u) {
        const envelope = Math.sin(Math.PI * t ** .83) ** .58;
        const side = u * width * envelope;
        const radial = 10 + length * t * spread + side ** 2 / (width * 6);
        const lift = length * t * (1 - .83 * spread)
          + 18 * Math.sin(t * Math.PI)
          - 29 * opening * t ** 5
          + 7 * Math.sin(u * 8 + index) * t ** 4;
        return project(radial * Math.cos(angle) - side * Math.sin(angle),
          lift, radial * Math.sin(angle) + side * Math.cos(angle));
      }
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 8; j++) {
          const t = i / 16;
          const u = j / 4 - 1;
          const points = [point(t, u), point(t + 1/16, u),
            point(t + 1/16, u + .25), point(t, u + .25)];
          const depth = points.reduce((sum, point) => sum + point[2], 0) / 4;
          const light = 37 + 42 * t + 11 * Math.cos(angle - view + .9) + 8 * u * u;
          patches.push({points, depth, light});
        }
      }
    }
  }

  patches.sort((a, b) => a.depth - b.depth);
  for (const {points, light} of patches) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.strokeStyle = ctx.fillStyle = gray
      ? `hsl(28 8% ${Math.min(94, light + 6)}%)`
      : `hsl(${339 + light * .15} 63% ${light}%)`;
    ctx.lineWidth = .9;
    ctx.fill();
    ctx.stroke();
  }
}
