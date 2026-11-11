/** Visual console footprints use a modest suit clearance. Existing movement
 * bounds/save schema stay unchanged; this only prevents camera penetration. */
export function cabinStep(fromX:number,fromZ:number,toX:number,toZ:number,bowConsole=false):[number,number]{
 let x=Math.max(-5.6,Math.min(5.6,toX)),z=Math.max(-5.65,Math.min(6.65,toZ));
 const footprints=[[-3,2.5,1.36,.86],[3,2.5,1.36,.86],[-3,-2.5,1.36,.86],[3,-2.5,1.36,.86]];
 if(bowConsole)footprints.push([0,-5.7,2.02,.83]);
 for(const [cx,cz,halfX,halfZ] of footprints){
  const left=cx-halfX,right=cx+halfX,back=cz-halfZ,front=cz+halfZ;
  if(x<=left||x>=right||z<=back||z>=front)continue;
  if(fromX<=left)x=left;
  else if(fromX>=right)x=right;
  else if(fromZ<=back)z=back;
  else if(fromZ>=front)z=front;
  else{
   // A legacy checkpoint can have been saved inside the former non-solid
   // equipment. Move to the nearest edge on its next movement, never trap it.
   const distances=[x-left,right-x,z-back,front-z],edge=distances.indexOf(Math.min(...distances));
   if(edge===0)x=left;else if(edge===1)x=right;else if(edge===2)z=back;else z=front;
  }
 }
 return [x,z];
}
