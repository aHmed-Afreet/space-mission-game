import * as T from 'three';

/** Original ORBITAL furniture models. All dimensions are metres. This source is
 * baked to a local GLB; none of this modelling work runs in the game loop. */
export function buildWorkstations(): T.Group {
  const root = new T.Group(); root.name = 'ORBITAL purpose-built cabin equipment';
  const material = (name: string, color: string, metalness: number, roughness: number) => {
    const m = new T.MeshStandardMaterial({color, metalness, roughness}); m.name = name; return m;
  };
  const paint = material('paint / warm ceramic equipment finish', '#d5d3c5', .18, .57);
  const titanium = material('metal / satin titanium', '#a6afb1', .7, .34);
  const graphite = material('paint / graphite composite', '#263137', .18, .67);
  const rubber = material('rubber / pressure seals and controls', '#182023', .03, .9);
  const fabric = material('fabric / blue-grey woven restraint upholstery', '#647a83', .0, .91);
  const strap = material('fabric / black harness webbing', '#242d30', 0, .98);
  const gold = material('metal / muted anodised safety gold', '#b79c63', .62, .44);
  const orange = material('paint / emergency identification orange', '#ba7654', .05, .68);
  const blue = material('paint / service identification blue', '#587a86', .12, .61);
  const glass = material('glass / polycarbonate laboratory shield', '#9bb4bb', .08, .19);
  glass.transparent = true; glass.opacity = .19; glass.depthWrite = false; glass.side = T.DoubleSide;
  const lamp = material('light / diffuse white practical', '#e3e5d9', 0, .5);
  lamp.emissive.set('#c9d0b7'); lamp.emissiveIntensity = .32;
  const add = (parent: T.Object3D, geo: T.BufferGeometry, mat: T.Material,
    x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new T.Mesh(geo, mat); m.position.set(x,y,z); m.rotation.set(rx,ry,rz); parent.add(m); return m;
  };
  function rounded(w: number, h: number, r: number, x=0, y=0): T.Shape {
    const s = new T.Shape(), l=x-w/2, b=y-h/2, rr=Math.min(r,w/2,h/2);
    s.moveTo(l+rr,b);s.lineTo(l+w-rr,b);s.quadraticCurveTo(l+w,b,l+w,b+rr);
    s.lineTo(l+w,b+h-rr);s.quadraticCurveTo(l+w,b+h,l+w-rr,b+h);
    s.lineTo(l+rr,b+h);s.quadraticCurveTo(l,b+h,l,b+h-rr);
    s.lineTo(l,b+rr);s.quadraticCurveTo(l,b,l+rr,b);s.closePath();return s;
  }
  function form(parent:T.Object3D,shape:T.Shape,depth:number,mat:T.Material,x=0,y=0,z=0,bevel=.015){
    return add(parent,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:8,steps:1}),mat,x,y,z);
  }
  function frame(parent:T.Object3D,w:number,h:number,r:number,border:number,mat:T.Material,x:number,y:number,z:number,depth=.06){
    const s=rounded(w,h,r); const inner=rounded(w-border*2,h-border*2,Math.max(.01,r-border));
    s.holes.push(new T.Path(inner.getPoints(10).reverse()));return form(parent,s,depth,mat,x,y,z,.008);
  }
  function tube(parent:T.Object3D,pts:number[][],r:number,mat:T.Material,segments=16){
    const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],p[1],p[2])),false,'centripetal');
    return add(parent,new T.TubeGeometry(curve,segments,r,6,false),mat);
  }
  function spindle(parent:T.Object3D,r:number,h:number,mat:T.Material,x:number,y:number,z:number,rx=0,ry=0,rz=0){
    return add(parent,new T.CylinderGeometry(r,r,h,14,1),mat,x,y,z,rx,ry,rz);
  }
  function vessel(parent:T.Object3D,r:number,h:number,mat:T.Material,x:number,y:number,z:number){
    const pts=[new T.Vector2(0,-h/2),new T.Vector2(r*.45,-h/2+.025),new T.Vector2(r*.88,-h/2+.07),new T.Vector2(r,-h/2+.16),new T.Vector2(r,h/2-.16),new T.Vector2(r*.88,h/2-.07),new T.Vector2(r*.45,h/2-.025),new T.Vector2(0,h/2)];
    return add(parent,new T.LatheGeometry(pts,18),mat,x,y,z);
  }
  function torus(parent:T.Object3D,r:number,t:number,mat:T.Material,x:number,y:number,z:number,rx=0,ry=0,arc=Math.PI*2){
    return add(parent,new T.TorusGeometry(r,t,6,24,arc),mat,x,y,z,rx,ry);
  }
  function screenFrame(parent:T.Object3D,w:number,h:number,y=1.68,x=0){
    frame(parent,w+.1,h+.1,.055,.044,graphite,x,y,-.085,.06);
    frame(parent,w+.136,h+.136,.065,.016,titanium,x,y,-.105,.038);
    for(const a of [-1,1])for(const b of [-1,1])spindle(parent,.012,.015,titanium,x+a*(w/2+.027),y+b*(h/2+.027),-.009,Math.PI/2);
  }
  function switchBank(parent:T.Object3D,x:number,y:number,z:number,count=6,spacing=.13){
    for(let i=0;i<count;i++){
      const px=x+(i-(count-1)/2)*spacing;
      spindle(parent,.025,.028,rubber,px,y,z,Math.PI/2);
      spindle(parent,.014,.045,i===count-1?orange:titanium,px,y,z+.025,Math.PI/2,0,.18);
      tube(parent,[[px-.034,y-.03,z+.018],[px-.034,y+.05,z+.018],[px+.034,y+.05,z+.018],[px+.034,y-.03,z+.018]],.006,titanium,6);
    }
  }
  function sideBay(name:string,side:-1|1,z:number){
    const g=new T.Group();g.name=name;g.position.set(side*1.78,0,z);g.rotation.y=-side*Math.PI/2;root.add(g);return g;
  }
  function tray(parent:T.Object3D,w:number,d:number,x:number,y:number,z:number,mat=titanium){
    const s=rounded(w,d,.12);const m=form(parent,s,.035,mat,x,y,z,.009);m.rotation.x=-Math.PI/2;
    // Rolled lip has a real curved cross-section rather than slab edges.
    const path=rounded(w+.02,d+.02,.13).getPoints(8).map(p=>new T.Vector3(x+p.x,y+.025,z-p.y));
    add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(path,true,'centripetal'),40,.014,5,true),rubber);
    return m;
  }
  function saddle(parent:T.Object3D,w:number,d:number,x:number,y:number,z:number,mat:T.Material){
    const vertices:number[]=[],uv:number[]=[],indices:number[]=[];const nx=14,nz=12;
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const u=i/nx*2-1,v=j/nz*2-1;
      const xx=u*w/2*(.91+.09*Math.cos(v*Math.PI/2));
      vertices.push(x+xx,y+.055*Math.pow(Math.abs(u),3)+.035*Math.pow(v,2),z+v*d/2);
      uv.push(i/nx,j/nz);
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,e=c+1;indices.push(a,c,b,b,c,e);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    return add(parent,geo,mat);
  }
  // FLIGHT DECK: two contoured restraint couches and one continuous instrument wing.
  const cockpit=new T.Group();cockpit.name='Flight deck / restraint couches and formed instrument wing';root.add(cockpit);
  for(const x of [-.8,.8]){
    const seat=new T.Group();seat.position.set(x,0,-5.2);seat.name='Contoured astronaut restraint couch';cockpit.add(seat);
    const shape=new T.Shape();shape.moveTo(-.24,.48);shape.bezierCurveTo(-.37,.75,-.35,1.21,-.29,1.38);shape.lineTo(-.19,1.43);shape.lineTo(-.17,1.67);shape.quadraticCurveTo(0,1.78,.17,1.67);shape.lineTo(.19,1.43);shape.lineTo(.29,1.38);shape.bezierCurveTo(.35,1.21,.37,.75,.24,.48);shape.closePath();
    const shell=form(seat,shape,.065,graphite,0,0,.22,.025);shell.rotation.x=-.08;
    const pad=form(seat,shape,.045,fabric,0,0,.135,.022);pad.scale.set(.89,.94,1);pad.rotation.x=-.08;
    saddle(seat,.58,.63,0,.47,-.03,fabric);
    const cradle=new T.Shape();cradle.moveTo(-.3,.37);cradle.quadraticCurveTo(0,.28,.3,.37);cradle.lineTo(.33,.46);cradle.lineTo(.24,.51);cradle.quadraticCurveTo(0,.45,-.24,.51);cradle.closePath();
    form(seat,cradle,.59,graphite,0,0,-.34,.018);
    vessel(seat,.13,.30,titanium,0,.21,-.02);
    torus(seat,.19,.025,rubber,0,.07,-.02,Math.PI/2);
    for(const side of [-1,1]){
      tube(seat,[[side*.29,.4,.2],[side*.36,.6,.16],[side*.36,.78,-.16]],.022,titanium,10);
      const arm=form(seat,rounded(.12,.43,.06),.055,rubber,side*.36,.78,-.17,.012);arm.rotation.x=-Math.PI/2;
      tube(seat,[[side*.14,1.40,.13],[side*.17,1.17,.09],[side*.08,.76,.06]],.025,strap,12);
      tube(seat,[[side*.25,.49,-.20],[side*.2,.61,-.04],[side*.08,.76,.06]],.025,strap,10);
      tube(seat,[[side*.22,.60,.34],[side*.27,.94,.36],[side*.20,1.34,.35]],.017,titanium,12);
    }
    spindle(seat,.055,.035,titanium,0,.76,.09,Math.PI/2);
    form(seat,rounded(.065,.12,.018),.016,orange,.13,.73,.1,.006);
    for(const side of [-1,1])tube(seat,[[side*.23,.53,.37],[side*.26,.93,.40],[side*.16,1.5,.37]],.012,rubber,10);
  }
  const panel=rounded(2.75,.7,.14);
  for(const x of [-.84,0,.84])panel.holes.push(new T.Path(rounded(.72,.47,.025,x).getPoints(10).reverse()));
  const panelGroup=new T.Group();panelGroup.position.set(0,1.32,-6.56);panelGroup.rotation.x=-.22;cockpit.add(panelGroup);
  form(panelGroup,panel,.035,graphite,0,0,0,.012);
  for(const x of [-.84,0,.84])frame(panelGroup,.78,.53,.042,.035,titanium,x,0,.031,.018);
  const wing=new T.Shape();wing.moveTo(-1.34,.61);wing.lineTo(-1.5,.91);wing.quadraticCurveTo(-1.52,1.04,-1.34,1.06);wing.lineTo(1.34,1.06);wing.quadraticCurveTo(1.52,1.04,1.5,.91);wing.lineTo(1.34,.61);wing.quadraticCurveTo(0,.46,-1.34,.61);wing.closePath();
  form(cockpit,wing,.47,paint,0,0,-6.8,.024);
  const apron=rounded(2.34,.27,.08);form(cockpit,apron,.025,graphite,0,.78,-6.30,.01);
  for(let i=0;i<9;i++){
    const x=(i-4)*.245;spindle(cockpit,.035,.035,rubber,x,.83,-6.25,Math.PI/2);
    spindle(cockpit,.015,.014,titanium,x,.83,-6.223,Math.PI/2);
  }
  switchBank(cockpit,0,1.00,-6.22,11,.22);
  for(const x of [-1.38,1.38]){
    tube(cockpit,[[x,.18,-6.55],[x,.54,-6.40],[x,.84,-6.28]],.055,graphite,10);
    tube(cockpit,[[x,.72,-6.12],[x,.99,-6.10],[x,1.08,-6.22]],.035,titanium,10);
    vessel(cockpit,.055,.18,rubber,x,1.05,-6.12);
  }
  const overhead=new T.Group();overhead.position.set(0,2.63,-5.88);overhead.rotation.x=.45;cockpit.add(overhead);
  form(overhead,rounded(1.80,.31,.1),.045,graphite,0,0,0,.012);switchBank(overhead,0,0,.06,9,.18);

  // COMMUNICATIONS: open-sided RF cage, cartridge fronts, tuning and coaxial loops.
  const comm=sideBay('Communications / RF transmission and receiver cage',1,-3.1);
  for(const x of [-.60,.60]){
    tube(comm,[[x,.17,-.48],[x-.03*Math.sign(x),.55,-.23],[x,1.2,-.20],[x,2.16,-.31],[x*.88,2.25,-.48]],.038,titanium,18);
    tube(comm,[[x*.9,.25,-.52],[x*.9,2.15,-.52]],.017,rubber,6);
  }
  form(comm,rounded(1.1,1.92,.16),.025,graphite,0,1.2,-.62,.012);
  screenFrame(comm,1,.55);
  for(let i=0;i<4;i++){
    const y=.45+i*.21;
    form(comm,rounded(1.06,.17,.04),.11,i%2?titanium:paint,0,y,-.18,.008);
    frame(comm,.40,.075,.014,.008,graphite,-.21,y,-.052,.01);
    for(let j=0;j<4;j++)spindle(comm,.009,.016,j===0?gold:rubber,-.36+j*.10,y,-.026,Math.PI/2);
    spindle(comm,.035,.042,rubber,.36,y,-.035,Math.PI/2);
    spindle(comm,.013,.011,titanium,.36,y,-.008,Math.PI/2);
    form(comm,rounded(.15,.026,.007),.013,blue,.08,y,-.03,.003);
  }
  for(const x of [-.43,-.19,.05,.29]){
    spindle(comm,.027,.1,titanium,x,2.03,-.18,Math.PI/2);
    tube(comm,[[x,2.03,-.09],[x+.045,2.17,.04],[x+.10,2.29,-.09],[x+.11,2.08,-.49]],.012,rubber,14);
  }
  tray(comm,1.2,.56,0,1.2,-.19,graphite);
  switchBank(comm,0,1.22,.08,5,.19);
  torus(comm,.13,.018,rubber,.44,1.48,-.05,0,0,Math.PI*1.7);

  // SCIENCE: a folded microscope support, curved clear experiment hood and sample carousel.
  const science=sideBay('Science / microgravity instrument workcell',-1,-3.1);
  tray(science,1.22,.71,0,1.03,-.24);
  const arch=rounded(1.14,.92,.18);arch.holes.push(new T.Path(rounded(.99,.78,.14).getPoints(10).reverse()));
  form(science,arch,.12,paint,0,1.60,-.34,.017);
  screenFrame(science,1,.55);
  for(const x of [-.52,.52])tube(science,[[x,.15,-.49],[x*.8,.57,-.41],[x,1.02,-.32]],.035,titanium,12);
  const shieldGeo=new T.CylinderGeometry(.38,.38,.65,24,1,true,-Math.PI/2,Math.PI);
  const shield=add(science,shieldGeo,glass,-.20,1.24,-.30,Math.PI/2);shield.scale.y=.75;
  for(const x of [-.52,.12])tube(science,[[x,1.04,-.02],[x,1.40,-.16],[x,1.39,-.47],[x,1.04,-.55]],.012,titanium,14);
  spindle(science,.19,.035,graphite,.31,1.08,-.18);
  torus(science,.14,.012,titanium,.31,1.11,-.18,Math.PI/2);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    vessel(science,.028,.15,glass,.31+Math.cos(a)*.11,1.19,-.18+Math.sin(a)*.11);
    spindle(science,.034,.024,blue,.31+Math.cos(a)*.11,1.28,-.18+Math.sin(a)*.11);
  }
  tube(science,[[-.43,1.06,-.42],[-.48,1.22,-.45],[-.42,1.45,-.43],[-.28,1.48,-.25]],.04,graphite,16);
  spindle(science,.046,.18,titanium,-.28,1.43,-.24,.23,0,0);
  spindle(science,.055,.045,rubber,-.28,1.53,-.22,.23,0,0);

  // ENGINEERING: exposed fluid loop, sealed pressure vessels and a finned pump.
  const eng=sideBay('Engineering / oxygen recovery and power loop',-1,.45);
  for(const x of [-.60,.60])tube(eng,[[x,.12,-.48],[x,.72,-.37],[x,2.18,-.44]],.035,titanium,10);
  form(eng,rounded(1.14,2.03,.18),.026,graphite,0,1.2,-.64,.014);
  screenFrame(eng,.68,.5);
  for(const x of [-.34,.34]){
    vessel(eng,.16,.88,paint,x,.84,-.20);
    for(const y of [.54,1.13])torus(eng,.164,.018,titanium,x,y,-.20,Math.PI/2);
    spindle(eng,.04,.10,gold,x,1.32,-.20);
    tube(eng,[[x,1.34,-.20],[x,1.49,-.22],[x*.72,1.54,-.51],[x*.72,2.06,-.53]],.018,titanium,14);
    torus(eng,.067,.010,orange,x,.84,-.028);
    spindle(eng,.017,.058,titanium,x,.84,-.005,Math.PI/2);
  }
  tube(eng,[[-.4,.35,-.16],[-.22,.29,-.07],[.23,.29,-.07],[.43,.38,-.18]],.027,titanium,16);
  spindle(eng,.13,.24,titanium,0,.51,-.38,Math.PI/2);
  for(let i=0;i<9;i++)torus(eng,.134,.009,graphite,0,.51,-.50+i*.029);
  torus(eng,.14,.037,paint,0,.51,-.14);
  spindle(eng,.056,.09,gold,0,.51,-.12,Math.PI/2);
  for(let i=0;i<5;i++){
    const x=-.4+i*.2;spindle(eng,.032,.05,rubber,x,2.03,-.35,Math.PI/2);
    tube(eng,[[x,2.03,-.31],[x,2.18,-.25],[x+.10,2.28,-.38],[x+.14,2.25,-.55]],.012,i%2?rubber:blue,12);
  }
  // Breaker strip: separate rails and guards expose actual electromechanical function.
  form(eng,rounded(.94,.15,.045),.045,paint,0,1.94,-.22,.007);
  switchBank(eng,0,1.94,-.15,6,.14);

  // GALLEY: contoured crew-service worktop, recessed water connector and warmer.
  const galley=sideBay('Galley / food warming and potable-water service',1,.45);
  tray(galley,1.22,.72,0,1.03,-.22);
  const apronShape=new T.Shape();apronShape.moveTo(-.56,.82);apronShape.quadraticCurveTo(-.64,.52,-.43,.26);apronShape.quadraticCurveTo(0,.16,.43,.26);apronShape.quadraticCurveTo(.64,.52,.56,.82);apronShape.closePath();
  form(galley,apronShape,.29,paint,0,0,-.48,.022);
  frame(galley,.65,.41,.1,.045,titanium,.15,.63,-.16,.025);
  form(galley,rounded(.55,.32,.07),.018,graphite,.15,.63,-.13,.006);
  tube(galley,[[.01,.64,-.08],[.01,.71,-.03],[.29,.71,-.03],[.29,.64,-.08]],.016,titanium,8);
  const back=rounded(1.14,1.1,.2);form(galley,back,.085,paint,0,1.72,-.53,.025);
  screenFrame(galley,.48,.4);
  frame(galley,.28,.63,.1,.034,titanium,-.44,1.62,-.24,.06);
  form(galley,rounded(.20,.54,.08),.012,graphite,-.44,1.62,-.17,.005);
  tube(galley,[[-.44,1.88,-.10],[-.44,1.83,-.015],[-.44,1.74,.015]],.025,titanium,10);
  spindle(galley,.048,.055,blue,-.44,1.75,.015);
  torus(galley,.056,.012,titanium,-.44,1.72,.015,Math.PI/2);
  tray(galley,.32,.32,-.43,1.24,-.04);
  for(const x of [-.42,-.14,.14,.42]){
    tube(galley,[[x,.30,-.10],[x,.43,-.025],[x,.72,-.03],[x,.85,-.13]],.012,strap,12);
  }
  tube(galley,[[-.53,1.07,.13],[-.53,1.20,.13],[.53,1.20,.13],[.53,1.07,.13]],.018,titanium,14);

  // CREW BERTH: a suspended sleeping restraint rather than a domestic box-bed.
  const berth=sideBay('Crew berth / fabric sleep restraint and privacy cove',-1,4.4);
  const cove=new T.Shape();cove.moveTo(-.61,.2);cove.lineTo(-.61,1.82);cove.quadraticCurveTo(-.61,2.1,-.34,2.14);cove.lineTo(.34,2.14);cove.quadraticCurveTo(.61,2.1,.61,1.82);cove.lineTo(.61,.2);cove.lineTo(.52,.2);cove.lineTo(.52,1.8);cove.quadraticCurveTo(.52,2.02,.29,2.04);cove.lineTo(-.29,2.04);cove.quadraticCurveTo(-.52,2.02,-.52,1.8);cove.lineTo(-.52,.2);cove.closePath();
  form(berth,cove,.18,paint,0,0,-.60,.016);
  const bag=new T.Shape();bag.moveTo(-.19,.24);bag.quadraticCurveTo(-.40,.4,-.41,.93);bag.lineTo(-.36,1.58);bag.quadraticCurveTo(0,1.82,.36,1.58);bag.lineTo(.41,.93);bag.quadraticCurveTo(.40,.4,.19,.24);bag.closePath();
  form(berth,bag,.12,fabric,0,0,-.37,.035);
  tube(berth,[[0,.32,-.19],[0,.76,-.19],[0,1.24,-.19],[0,1.56,-.19]],.009,rubber,15);
  for(const y of [.55,.84,1.13,1.42])tube(berth,[[-.34,y,-.18],[0,y+.016,-.17],[.34,y,-.18]],.008,strap,10);
  for(const x of [-.44,.44])tube(berth,[[x,.32,-.39],[x,.78,-.29],[x,1.5,-.31],[x,1.89,-.49]],.016,titanium,16);
  form(berth,rounded(.48,.21,.1),.12,fabric,0,1.82,-.36,.025);
  form(berth,rounded(.58,.045,.018),.018,lamp,0,2.04,-.28,.005);
  // A folded privacy curtain hangs outside the walking/target area.
  for(let i=0;i<6;i++)tube(berth,[[.48+i*.018,.35,-.45],[.46+i*.018,1.06,-.39],[.48+i*.018,1.85,-.45]],.024,fabric,14);

  // REPAIR: fold-out formed work tray with real retention rails and tool clips.
  const repair=sideBay('Equipment / retained service tools and repair tray',1,4.4);
  tray(repair,1.22,.73,0,1.03,-.22);
  for(const x of [-.48,.48])tube(repair,[[x,.43,-.59],[x,.55,-.24],[x,1.0,.04]],.025,titanium,10);
  // Upper repair instrumentation clears the adjacent suit cradle. Its retained
  // work tray and analytic station stay in the original footprint.
  const repairTop=new T.Group();repairTop.position.x=.27;repair.add(repairTop);
  form(repairTop,rounded(.88,1.25,.13),.06,graphite,0,1.66,-.46,.017);
  screenFrame(repairTop,.65,.45);
  frame(repairTop,.94,1.36,.16,.035,titanium,0,1.65,-.49,.03);
  for(const x of [-.39,.39])for(let i=0;i<3;i++){
    const y=1.31+i*.26;
    spindle(repairTop,.019,.11,titanium,x,y,-.33,0,0,Math.PI/2);
    vessel(repairTop,.024,.13,i===2?orange:rubber,x,y+.05,-.27);
    spindle(repairTop,.009,.12,titanium,x,y-.06,-.27);
  }
  for(let i=0;i<4;i++){
    const x=-.36+i*.24;torus(repair,.064,.014,rubber,x,1.085,-.12,Math.PI/2);
    spindle(repair,.023,.04,titanium,x,1.11,-.12);
  }
  tube(repair,[[-.54,.33,-.20],[-.54,.30,-.03],[.54,.30,-.03],[.54,.33,-.20]],.023,titanium,14);
  for(let i=0;i<3;i++){
    const y=.46+i*.16;frame(repair,1.02,.12,.035,.018,paint,0,y,-.24,.035);
  }
  // Each cell has real isolated floor mounts and rear structural brackets.
  // These connect the shaped equipment to the pressure-module rails, rather
  // than leaving the pods or their cabling suspended in empty space.
  for(const cell of [comm,science,eng,galley,repair])for(const side of [-1,1]){
    vessel(cell,.065,.17,rubber,side*.46,.085,-.43);
    torus(cell,.084,.013,titanium,side*.46,.025,-.43,Math.PI/2);
    tube(cell,[[side*.47,.22,-.50],[side*.47,.30,-.72],[side*.47,.30,-1.18]],.022,titanium,10);
  }
  for(const x of [-.48,.48])for(const y of [.4,1.8]){
    tube(berth,[[x,y,-.57],[x,y,-.83],[x,y,-1.18]],.022,titanium,8);
    spindle(berth,.045,.045,rubber,x,y,-1.18,Math.PI/2);
  }
  root.updateMatrixWorld(true);
  return root;
}
