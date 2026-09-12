import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const outcomes: unknown[] = [];
async function get(path:string, status=200) {
  const r=await fetch(base+path,{signal:AbortSignal.timeout(65_000),redirect:"manual"});
  assert.equal(r.status,status,path); const body=await r.json(); return body;
}
async function post(path:string,body:unknown,status=200) {
  const r=await fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(65_000)});
  assert.equal(r.status,status,path); return await r.json();
}
async function main() {
  for(const path of ["/api/dashboard-summary","/api/habitations","/api/red-zones","/api/safe-sites"]) { const data=await get(path); assert.ok(Array.isArray(data)?data.every(v=>v.source==="Demo Dataset"):data.source==="Demo Dataset"); outcomes.push({path,status:200,provenance:"demo"}); }
  await get("/api/relocation-plan",405);
  await post("/api/relocation-plan",{habitationId:"missing"},401);
  outcomes.push({path:"/api/relocation-plan",get:405,guestPost:401});
  await get("/api/weather?lat=NaN&lon=77",400); await get("/api/earthquakes?lat=10",400); await get("/api/disaster-news?radius=99999",400); await get("/api/geocode?q=" ,400);
  await post("/api/simulate-risk",{habitation_id:1,rainfall:85,road_access:40,population_vulnerability:70});
  await post("/api/simulate-risk",{habitation_id:1,rainfall:101,road_access:40,population_vulnerability:70},400);
  outcomes.push({inputValidation:"passed",legacySimulation:"passed"});
  for(const path of ["/api/profile"]) await get(path,401);
  await post("/api/saved-locations",{name:"Delhi",latitude:28.61,longitude:77.21,consent:false},400);
  await post("/api/saved-locations",{name:"Delhi",latitude:28.61,longitude:77.21,consent:true},401);
  const protectedPage=await fetch(base+"/profile",{redirect:"manual"}); assert.ok([307,308].includes(protectedPage.status)); assert.match(protectedPage.headers.get("location") || "",/login/);
  outcomes.push({guestIsolation:"passed",protectedProfile:"redirects-to-login"});
  const regions:Array<[string,number,number]>=[["Uttarakhand",30.32,78.03],["Delhi",28.61,77.21],["Uttar Pradesh",26.85,80.95],["Assam",26.14,91.74],["Maharashtra",19.08,72.88],["Kerala",8.52,76.94],["Tamil Nadu",13.08,80.27],["Odisha",20.30,85.82],["Himachal Pradesh",31.10,77.17]];
  for (const [region,lat,lon] of regions) {const r=await get(`/api/weather?lat=${lat}&lon=${lon}`); assert.ok(["live","cached","unavailable","stale"].includes(r.status)); outcomes.push({provider:"Open-Meteo",region,status:r.status,time:r.data?.time});}
  for(const path of ["/api/alerts","/api/earthquakes","/api/geocode?q=Lucknow","/api/boundaries?level=ADM1","/api/groundwater?lat=26.85&lon=80.95","/api/disaster-news?state=Delhi&limit=5","/api/nearby-sites?lat=28.61&lon=77.21&radius=5","/api/location-risk?lat=28.61&lon=77.21&state=Delhi"]) {
    const result=await get(path); outcomes.push({path,status:result.status,source:result.source,count:Array.isArray(result.data)?result.data.length:undefined,risk:result.risk?.status,providers:result.risk?Object.fromEntries(["alerts","weather","earthquakes","news","facilities","groundwater"].map(k=>[k,result[k]?.status])):undefined});
  }
  // Run only when server has no Groq key: no test requests should spend credentials.
  if(process.env.TEST_AI_UNCONFIGURED==="1") {
    for(const language of ["en","hi"]) await post("/api/ai/chat",{language,messages:[{role:"user",content:language==="hi"?"मेरे आसपास कोई चेतावनी है?":"What should I do?"}]},503);
    let limited=false;
    for(let i=0;i<10;i++) {const r=await fetch(base+"/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"user",content:"test"}]})}); if(r.status===429) {limited=true;break;}}
    assert.ok(limited); outcomes.push({aiMissingConfiguration:"en-hi-passed",aiRateLimit:"passed"});
  }
  console.log(JSON.stringify(outcomes,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
