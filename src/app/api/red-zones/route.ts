export function GET(){return Response.json({code:"DEMO_RETIRED",error:"Demo assessments have been retired. Use live weather, alerts, earthquakes and nearby-sites endpoints."},{status:410});}
export const POST=GET;
