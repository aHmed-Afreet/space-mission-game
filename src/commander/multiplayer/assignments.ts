import type {CrewMember} from "./protocol";

/** The campaign engine advances objectives in order. Each objective has one
 * exclusive astronaut; the next owner waits until earlier work is complete. */
export function objectiveOwner(index:number,members:readonly Pick<CrewMember,"id"|"role">[]):string|null{
 const seats=[...members].sort((a,b)=>
  ["Commander","Engineer","Scientist","Communications"].indexOf(a.role)-
  ["Commander","Engineer","Scientist","Communications"].indexOf(b.role));
 return seats.length?seats[index%seats.length].id:null;
}

export function assignedObjectives(count:number,ownId:string,members:readonly Pick<CrewMember,"id"|"role">[]):number[]{
 return Array.from({length:count},(_,i)=>i).filter(i=>objectiveOwner(i,members)===ownId);
}
