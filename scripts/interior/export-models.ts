import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {writeFileSync,mkdirSync} from 'node:fs';
import {buildPressureShell} from '../../src/commander/pressureShellModel';
import {buildWorkstations} from './workstations';
import {batchStaticVisuals} from '../../src/presentation/staticBatch';
class Reader {result:ArrayBuffer|string|null=null;onloadend:null|(()=>void)=null;onload:null|(()=>void)=null;readAsArrayBuffer(blob:Blob){blob.arrayBuffer().then(b=>{this.result=b;this.onload?.();this.onloadend?.();});}readAsDataURL(blob:Blob){blob.arrayBuffer().then(b=>{this.result='data:application/octet-stream;base64,'+Buffer.from(b).toString('base64');this.onload?.();this.onloadend?.();});}}
Object.assign(globalThis,{FileReader:Reader});
mkdirSync('public/assets/interior',{recursive:true});
for(const [name,build]of[['mission-shell',buildPressureShell],['mission-workstations',buildWorkstations]]as const){
 const model=build();batchStaticVisuals(model);
 model.updateMatrixWorld(true);
 const output=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
 writeFileSync('public/assets/interior/'+name+'.glb',Buffer.from(output as ArrayBuffer));
 let triangles=0,draws=0;model.traverse(o=>{if(o instanceof T.Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;draws++;}});console.log(name,(output as ArrayBuffer).byteLength,'bytes',triangles,'triangles',draws,'draws');
}
