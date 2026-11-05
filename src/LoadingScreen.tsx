/** Loading state for real lazy downloads; the indicator does not invent a percentage. */
export default function LoadingScreen({detail="Preparing your mission systems…"}:{detail?:string}){
  return <main className="orbital-loading" role="status" aria-live="polite">
    <div className="orbital-loading-orbit" aria-hidden="true"><span/></div>
    <small>ORBITAL / MISSION LAB</small>
    <h1>PREPARING YOUR MISSION</h1>
    <p>{detail}</p>
    <div className="orbital-loading-track" aria-hidden="true"><span/></div>
    <p className="orbital-loading-note">Your existing progress is preserved.</p>
  </main>;
}
