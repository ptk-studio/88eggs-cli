import { apiFetch, handleApiResponse } from "./dist/lib/api.js";
const DEF_ID = "_64RfbH9R4FBH8i4cxI2G";
const NEW_STYLE = { name:"style", type:"select_from_data_table", data_table_id:"iiIBqX4HN8lGpLzziDfry", label:"Style", default:"random", option_label_column:"name", option_value_column:"style", required:true };
const def = await handleApiResponse(apiFetch(`/pipeline-definitions/${DEF_ID}`));
if (def.parameters.find(p=>p.name==="style")?.type === "select_from_data_table"){ console.log("ALREADY_APPLIED"); process.exit(0); }
const newParams = def.parameters.map((p) => (p.name === "style" ? NEW_STYLE : p));
for (let i=1;i<=18;i++){
  const res = await apiFetch(`/pipeline-definitions/${DEF_ID}`, { method:"PATCH", body: JSON.stringify({ parameters: newParams }) });
  const text = await res.text();
  if (res.status>=200 && res.status<300){
    const s = JSON.parse(text).parameters.find(p=>p.name==="style");
    console.log(`APPLIED on attempt ${i}:`, JSON.stringify(s));
    process.exit(0);
  }
  console.log(`attempt ${i}: HTTP ${res.status} — deploy not live yet`);
  await new Promise(r=>setTimeout(r, 20000));
}
console.log("TIMED_OUT waiting for backend deploy"); process.exit(2);
