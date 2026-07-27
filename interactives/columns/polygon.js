(() => {
  const root = window.__polygonRoot || document;
  const $ = (id) => (root.querySelector ? root.querySelector("#" + id) : document.getElementById(id));
  const canvas = $('shapeCanvas');
  const ctx = canvas.getContext('2d');

  const sliders = {
    trajectory: $('trajectorySlider'),
    dimension: $('dimensionSlider'),
    extension: $('extensionSlider'),
    recombination: $('recombinationSlider')
  };

  const outputs = {
    trajectory: $('trajectoryOutput'),
    dimension: $('dimensionOutput'),
    extension: $('extensionOutput'),
    recombination: $('recombinationOutput')
  };

  const rotateButton = $('rotateButton');
  const resetButton = $('resetButton');
  const labelNodes = [...root.querySelectorAll('#stageLabels span')];

  const ui = {
    stageTag: $('stageTag'),
    phase: $('phase'),
    descriptor: $('descriptor'),
    shapeTitle: $('shapeTitle'),
    description: $('description'),
    dimensionMetric: $('dimensionMetric'),
    vertexMetric: $('vertexMetric'),
    unitMetric: $('unitMetric'),
    conditionMetric: $('conditionMetric'),
    canvasNote: $('canvasNote'),
    essayNote: $('essayNote')
  };

  let autoRotate = true;
  let rotationY = 0.66;
  let rotationX = -0.28;
  let rotation4A = 0.18;
  let rotation4B = -0.31;
  let dragStart = null;
  let lastTime = performance.now();
  let customMode = false;

  const clamp = (v, min=0, max=1) => Math.max(min, Math.min(max, v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const smooth = t => {
    const x = clamp(t);
    return x*x*(3-2*x);
  };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function trajectoryToParameters(value) {
    const t = clamp(value / 100);
    if (t <= .25) {
      return {dimension:smooth(t/.25), extension:0, recombination:0};
    }
    if (t <= .50) {
      return {dimension:1, extension:smooth((t-.25)/.25), recombination:0};
    }
    if (t <= .75) {
      return {dimension:1, extension:1, recombination:smooth((t-.50)/.25)*.5};
    }
    return {dimension:1, extension:1, recombination:.5 + smooth((t-.75)/.25)*.5};
  }

  function parametersToTrajectory(dimension, extension, recombination) {
    if (dimension < .995) return dimension * 25;
    if (extension < .995) return 25 + extension * 25;
    if (recombination < .5) return 50 + recombination * 50;
    return 75 + (recombination-.5) * 50;
  }

  function currentParameters() {
    return {
      dimension:Number(sliders.dimension.value)/100,
      extension:Number(sliders.extension.value)/100,
      recombination:Number(sliders.recombination.value)/100
    };
  }

  function applyMaster(value) {
    const p = trajectoryToParameters(value);
    sliders.dimension.value = Math.round(p.dimension*100);
    sliders.extension.value = Math.round(p.extension*100);
    sliders.recombination.value = Math.round(p.recombination*100);
  }

  function rotate3(p, rx, ry) {
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const x1 = p.x * cosY + p.z * sinY;
    const z1 = -p.x * sinY + p.z * cosY;
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    return {x:x1, y:p.y*cosX-z1*sinX, z:p.y*sinX+z1*cosX};
  }

  function project3(p, width, height, scaleMultiplier=1) {
    const camera = 6.8;
    const perspective = camera / (camera - p.z);
    const scale = Math.min(width, height) * 0.27 * scaleMultiplier;
    return {x:width/2+p.x*scale*perspective, y:height/2+p.y*scale*perspective, z:p.z};
  }

  function normalizeVertices(vertices, targetRadius=1.55) {
    const center = vertices.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y,z:a.z+p.z}),{x:0,y:0,z:0});
    center.x/=vertices.length; center.y/=vertices.length; center.z/=vertices.length;
    const centered = vertices.map(p=>({x:p.x-center.x,y:p.y-center.y,z:p.z-center.z}));
    const radius = Math.max(...centered.map(p=>Math.hypot(p.x,p.y,p.z)), .0001);
    const scale = targetRadius/radius;
    return centered.map(p=>({x:p.x*scale,y:p.y*scale,z:p.z*scale}));
  }

  function rotatePlane(v, i, j, angle) {
    const out = v.slice();
    const c=Math.cos(angle), s=Math.sin(angle);
    out[i]=v[i]*c-v[j]*s;
    out[j]=v[i]*s+v[j]*c;
    return out;
  }

  function makeComplexPolygonVertices() {
    const vertices4=[];
    for(let i=0;i<4;i++){
      const a=Math.PI/4+i*Math.PI/2;
      for(let j=0;j<4;j++){
        const b=Math.PI/4+j*Math.PI/2;
        let v=[Math.cos(a),Math.sin(a),Math.cos(b),Math.sin(b)];
        v=rotatePlane(v,0,2,rotation4A);
        v=rotatePlane(v,1,3,rotation4B);
        v=rotatePlane(v,0,3,rotation4B*.58);
        vertices4.push(v);
      }
    }
    const vertices = vertices4.map(v=>{
      const d=3.1;
      const factor=d/(d-v[3]);
      return {x:v[0]*factor,y:v[1]*factor,z:v[2]*factor};
    });
    return normalizeVertices(vertices,1.52);
  }

  function rectanglePerimeterPoint(i, sx, sz) {
    const points = [
      [-.5,-.5],[0,-.5],[.5,-.5],[.5,0],
      [.5,.5],[0,.5],[-.5,.5],[-.5,0]
    ];
    return {x:points[i][0]*sx, z:points[i][1]*sz};
  }

  function complexPerimeterPoint(i, sx, sz) {
    const angle = -Math.PI*3/4 + i*Math.PI/4;
    const radius = i%2===0 ? 1 : .73;
    return {
      x:Math.cos(angle)*sx*.58*radius,
      z:Math.sin(angle)*sz*.58*radius
    };
  }

  function makeMorphGeometry(params) {
    const d = smooth(params.dimension);
    const e = smooth(params.extension);
    const r = smooth(params.recombination);
    const taper = smooth(clamp(r*2));
    const complexity = smooth(clamp((r-.5)*2));

    const sx = lerp(2.0,2.7,e);
    const sy = lerp(2.0,1.38,e);
    const sz = lerp(.015,1.9,d) * lerp(1,.82,e);
    const topScale = lerp(1,.48,taper);
    const topShiftX = .20*taper;
    const topShiftZ = -.10*taper;
    const perimeterMorph = smooth(clamp(complexity/.65));
    const twist = complexity*Math.PI*.42;

    const vertices=[];
    for(let ring=0;ring<2;ring++){
      const top = ring===1;
      const y = top ? -sy/2 : sy/2;
      for(let i=0;i<8;i++){
        const base = rectanglePerimeterPoint(i,sx,sz);
        const target = complexPerimeterPoint(i,sx,Math.max(sz,.55));
        let x = lerp(base.x,target.x,perimeterMorph);
        let z = lerp(base.z,target.z,perimeterMorph);
        if(top){
          x*=topScale;
          z*=topScale;
          const c=Math.cos(twist), s=Math.sin(twist);
          const xr=x*c-z*s;
          const zr=x*s+z*c;
          x=xr+topShiftX;
          z=zr+topShiftZ;
        }
        vertices.push({x,y,z});
      }
    }

    const prismFaces=[
      [7,6,5,4,3,2,1,0],
      [8,9,10,11,12,13,14,15]
    ];
    for(let i=0;i<8;i++) prismFaces.push([i,(i+1)%8,8+(i+1)%8,8+i]);

    let complexBlend = smooth(clamp((complexity-.62)/.38));
    let finalVertices = vertices;
    if(complexBlend>0){
      const target = makeComplexPolygonVertices();
      const base = normalizeVertices(vertices,1.52);
      finalVertices = base.map((p,i)=>({
        x:lerp(p.x,target[i].x,complexBlend),
        y:lerp(p.y,target[i].y,complexBlend),
        z:lerp(p.z,target[i].z,complexBlend)
      }));
    } else {
      finalVertices = normalizeVertices(vertices,1.52);
    }

    const complexCycles=[];
    for(let j=0;j<4;j++) complexCycles.push([j,4+j,8+j,12+j]);
    for(let i=0;i<4;i++) complexCycles.push([i*4,i*4+1,i*4+2,i*4+3]);

    return {vertices:finalVertices, prismFaces, complexCycles, complexBlend, d, e, r, taper, complexity};
  }

  function faceNormal(points) {
    if(points.length<3) return {x:0,y:0,z:1};
    const a=points[0],b=points[1],c=points[2];
    const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
    const v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
    const n={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
    const l=Math.hypot(n.x,n.y,n.z)||1;
    return {x:n.x/l,y:n.y/l,z:n.z/l};
  }

  function drawBackground(width,height){
    const grad=ctx.createRadialGradient(width*.44,height*.4,20,width*.5,height*.52,Math.max(width,height)*.72);
    grad.addColorStop(0,'#ffffff');
    grad.addColorStop(1,'#ececec');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,width,height);
  }

  function drawShadow(width,height,intensity=.12){
    const cy=height/2+Math.min(width,height)*.29;
    const shadow=ctx.createRadialGradient(width/2,cy,2,width/2,cy,Math.min(width,height)*.28);
    shadow.addColorStop(0,`rgba(0,0,0,${intensity})`);
    shadow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=shadow;
    ctx.beginPath();
    ctx.ellipse(width/2,cy,Math.min(width,height)*.28,Math.min(width,height)*.055,0,0,Math.PI*2);
    ctx.fill();
  }

  function drawFaceSet(vertices, faces, width, height, rotationBlend, alpha=1) {
    const rotated=vertices.map(p=>rotate3(p,rotationX*rotationBlend,rotationY*rotationBlend));
    const projected=rotated.map(p=>project3(p,width,height,.96));
    const faceData=faces.map(indices=>{
      const pts3=indices.map(i=>rotated[i]);
      return {indices,avgZ:pts3.reduce((s,p)=>s+p.z,0)/pts3.length,normal:faceNormal(pts3)};
    }).sort((a,b)=>a.avgZ-b.avgZ);
    const light={x:-.46,y:-.55,z:.7};
    faceData.forEach(face=>{
      const pts=face.indices.map(i=>projected[i]);
      ctx.beginPath();
      pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.closePath();
      const illumination=Math.max(-1,Math.min(1,face.normal.x*light.x+face.normal.y*light.y+face.normal.z*light.z));
      const gray=Math.round(216+illumination*27);
      ctx.fillStyle=`rgba(${gray},${gray},${gray},${.82*alpha})`;
      ctx.fill();
      ctx.strokeStyle=`rgba(17,17,17,${alpha})`;
      ctx.lineWidth=1.35;
      ctx.stroke();
    });
  }

  function drawComplexCycles(vertices, cycles, width, height, rotationBlend, alpha) {
    const rotated=vertices.map(p=>rotate3(p,rotationX*rotationBlend,rotationY*rotationBlend));
    const projected=rotated.map(p=>project3(p,width,height,.96));
    const cycleData=cycles.map((indices,index)=>({
      indices,index,avgZ:indices.reduce((s,i)=>s+rotated[i].z,0)/indices.length
    })).sort((a,b)=>a.avgZ-b.avgZ);
    cycleData.forEach(({indices,index})=>{
      const pts=indices.map(i=>projected[i]);
      ctx.beginPath();
      pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.closePath();
      ctx.fillStyle=index<4?`rgba(185,185,185,${.12*alpha})`:`rgba(225,225,225,${.08*alpha})`;
      ctx.fill();
      ctx.strokeStyle=index<4?`rgba(0,0,0,${.78*alpha})`:`rgba(0,0,0,${.48*alpha})`;
      ctx.lineWidth=index<4?1.4:1;
      ctx.stroke();
    });
    rotated.map((p,i)=>({i,z:p.z})).sort((a,b)=>a.z-b.z).forEach(({i,z})=>{
      const p=projected[i];
      const radius=2.7+(z+2)*.25;
      ctx.beginPath();
      ctx.arc(p.x,p.y,radius,0,Math.PI*2);
      ctx.fillStyle=`rgba(17,17,17,${alpha})`;
      ctx.fill();
      ctx.strokeStyle=`rgba(255,255,255,${alpha})`;
      ctx.lineWidth=1;
      ctx.stroke();
    });
  }

  function draw() {
    const width=canvas.clientWidth;
    const height=canvas.clientHeight;
    ctx.clearRect(0,0,width,height);
    drawBackground(width,height);
    const params=currentParameters();
    const g=makeMorphGeometry(params);
    const rotationBlend=smooth(g.d);
    if(g.d>.06) drawShadow(width,height,.11);
    drawFaceSet(g.vertices,g.prismFaces,width,height,rotationBlend,1-g.complexBlend*.88);
    if(g.complexBlend>.01) drawComplexCycles(g.vertices,g.complexCycles,width,height,rotationBlend,g.complexBlend);
  }

  function stateDescription(params) {
    const d=params.dimension, e=params.extension, r=params.recombination;
    if(d<.06){
      return {
        phase:'Modernist Centre', title:'Square', descriptor:'2 real dimensions · 4 vertices',
        spatial:'2D plane', vertices:'4', units:'1 face', condition:'Orthogonal reduction',
        note:'Increase dimension to extrude the plane.',
        description:'The square is a unified planar sign: regular, orthogonal, and stripped of inherited ornament.',
        essay:'At the modernist centre, complexity is subordinated to a single legible geometric order.', stage:0
      };
    }
    if(d<.94 && e<.08){
      return {
        phase:'Dimensional Transition', title:'Square → Cube', descriptor:'2D plane becoming 3D volume',
        spatial:'2D → 3D', vertices:'4 → 8', units:'1 → 6 faces', condition:'Dimensional extrusion',
        note:'Depth is being introduced continuously.',
        description:'The planar square is extruded into volume. Its edges remain orthogonal as dimension returns.',
        essay:'The first change is not stylistic ornament but spatial extension.', stage:1
      };
    }
    if(e<.08 && r<.05){
      return {
        phase:'Dimensional Return', title:'Cube', descriptor:'3 real dimensions · 8 vertices',
        spatial:'3D volume', vertices:'8', units:'6 faces', condition:'Regular orthogonal volume',
        note:'Drag to rotate. Double click to reset the view.',
        description:'The square acquires depth and becomes a cube. Its geometry remains regular, unified, and structurally legible.',
        essay:'Dimension returns without disrupting modernist order.', stage:1
      };
    }
    if(e<.94 && r<.05){
      return {
        phase:'Orthogonal Extension', title:'Cube → Rectangular Prism', descriptor:'3D volume under proportional extension',
        spatial:'3D volume', vertices:'8', units:'6 faces', condition:'Changing proportion',
        note:'The orthogonal system stretches without yet deforming.',
        description:'The cube lengthens into a rectangular prism. Proportion changes while the right-angled system remains intact.',
        essay:'The rectangle is modernist geometry extended through proportion.', stage:2
      };
    }
    if(r<.08){
      return {
        phase:'Orthogonal Extension', title:'Rectangular Prism', descriptor:'3 real dimensions · 8 vertices',
        spatial:'3D volume', vertices:'8', units:'6 faces', condition:'Elongated orthogonal volume',
        note:'Increase faceting to contract and redirect the upper face.',
        description:'The cube has become an elongated rectangular prism, but its structural grammar remains orthogonal.',
        essay:'The rectangle is the modernist block at the threshold of deformation.', stage:2
      };
    }
    if(r<.48){
      return {
        phase:'Faceted Deviation', title:'Prism → Truncated Pyramid', descriptor:'Continuous tapering of parallel faces',
        spatial:'3D volume', vertices:'8', units:'6 faces', condition:'Trapezoidal deformation',
        note:'The upper face contracts while the object remains structurally legible.',
        description:'The rectangular prism is gradually tapered into a frustum. Angle, direction, and hierarchy enter the block.',
        essay:'Complexity appears as a controlled consequence of the reduced geometric system.', stage:3
      };
    }
    if(r<.86){
      return {
        phase:'Geometric Recombination', title:'Truncated Pyramid → Complex Polyhedron', descriptor:'Facets multiply and the upper field twists',
        spatial:'3D projected volume', vertices:'8 → 16', units:'6 → 10 faces', condition:'Twist, faceting, and multiplication',
        note:'The frustum is separating into a denser geometric field.',
        description:'The trapezoidal block acquires additional vertices and a controlled twist. Modernist abstraction becomes the material of renewed complexity.',
        essay:'The rectangle is no longer merely distorted; it is being recombined.', stage:4
      };
    }
    return {
      phase:'Postmodern Recombination', title:'Regular Complex Polygon 4{4}2', descriptor:'2 complex dimensions · 4 real dimensions · 16 vertices',
      spatial:'C² / projected R⁴', vertices:'16', units:'8 four-vertex complex edges', condition:'Higher-dimensional recombination',
      note:'A rotating 3D projection of a higher-dimensional structure.',
      description:'The endpoint is a schematic projection of 4{4}2. The square has not disappeared; it has multiplied and recombined in a higher-dimensional structure.',
      essay:'This is the reversal: modernist reduction becomes the grammar through which postmodern complexity is produced.', stage:4
    };
  }

  function updateUI() {
    const params=currentParameters();
    const s=stateDescription(params);
    const estimated=parametersToTrajectory(params.dimension,params.extension,params.recombination);
    ui.stageTag.textContent=customMode?`CUSTOM MORPH ${Math.round(estimated)}%`:`TRAJECTORY ${sliders.trajectory.value}%`;
    ui.phase.textContent=s.phase;
    ui.descriptor.textContent=s.descriptor;
    ui.shapeTitle.textContent=s.title;
    ui.shapeTitle.classList.toggle('long-title', s.title.length > 22);
    ui.description.textContent=s.description;
    ui.dimensionMetric.textContent=s.spatial;
    ui.vertexMetric.textContent=s.vertices;
    ui.unitMetric.textContent=s.units;
    ui.conditionMetric.textContent=s.condition;
    ui.canvasNote.textContent=s.note;
    ui.essayNote.textContent=s.essay;
    outputs.trajectory.textContent=customMode?'CUSTOM':`${sliders.trajectory.value}%`;
    outputs.dimension.textContent=`${sliders.dimension.value}%`;
    outputs.extension.textContent=`${sliders.extension.value}%`;
    outputs.recombination.textContent=`${sliders.recombination.value}%`;
    labelNodes.forEach((node,i)=>node.classList.toggle('active',i===s.stage));
  }

  function updateFromMaster() {
    customMode=false;
    applyMaster(Number(sliders.trajectory.value));
    updateUI();
    draw();
  }

  function updateFromParameter() {
    customMode=true;
    const p=currentParameters();
    sliders.trajectory.value=Math.round(parametersToTrajectory(p.dimension,p.extension,p.recombination));
    updateUI();
    draw();
  }

  function reset() {
    sliders.trajectory.value=0;
    applyMaster(0);
    rotationY=.66;
    rotationX=-.28;
    rotation4A=.18;
    rotation4B=-.31;
    autoRotate=true;
    customMode=false;
    rotateButton.textContent='Pause rotation';
    updateUI();
    draw();
  }

  sliders.trajectory.addEventListener('input',updateFromMaster);
  sliders.dimension.addEventListener('input',updateFromParameter);
  sliders.extension.addEventListener('input',updateFromParameter);
  sliders.recombination.addEventListener('input',updateFromParameter);

  rotateButton.addEventListener('click',()=>{
    autoRotate=!autoRotate;
    rotateButton.textContent=autoRotate?'Pause rotation':'Resume rotation';
  });
  resetButton.addEventListener('click',reset);

  canvas.addEventListener('pointerdown',e=>{
    if(Number(sliders.dimension.value)<4) return;
    dragStart={x:e.clientX,y:e.clientY,ry:rotationY,rx:rotationX};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!dragStart) return;
    rotationY=dragStart.ry+(e.clientX-dragStart.x)*.01;
    rotationX=Math.max(-1.2,Math.min(1.2,dragStart.rx+(e.clientY-dragStart.y)*.008));
    draw();
  });
  canvas.addEventListener('pointerup',e=>{
    dragStart=null;
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointercancel',()=>{dragStart=null;});
  canvas.addEventListener('dblclick',()=>{
    rotationY=.66;
    rotationX=-.28;
    rotation4A=.18;
    rotation4B=-.31;
    draw();
  });

  window.addEventListener('resize',()=>{resizeCanvas();draw();});

  function animate(now) {
    const dt=Math.min(40,now-lastTime);
    lastTime=now;
    const params=currentParameters();
    if(autoRotate&&params.dimension>.04&&!dragStart){
      rotationY+=dt*.00032;
      if(params.recombination>.78){
        rotation4A+=dt*.00015;
        rotation4B-=dt*.00011;
      }
      draw();
    }
    requestAnimationFrame(animate);
  }

  applyMaster(0);
  resizeCanvas();
  updateUI();
  draw();
  requestAnimationFrame(animate);
})();
