import {localBrowser,Stagehand} from "@browserbasehq/stagehand";
import {z} from "zod";
import {readFileSync} from "node:fs";
import {homedir} from "node:os";
const command=process.argv[2] || "status";
const args=process.argv.slice(3);
const apiKey=process.env.STAGEHAND_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.OPENAI_API_KEY;
const modelName=process.env.STAGEHAND_MODEL || (process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "google/gemini-2.5-flash" : "openai/gpt-4o-mini");
// Reuse the existing authenticated localhost gateway without copying secrets.
function getOmniKey(){
 try{
   const raw=readFileSync(homedir()+"/.hermes/.env","utf8");
   const line=raw.split(/\r?\n/).find(s=>s.startsWith("HERMES_CUSTOM_LOCALHOST_3001_API_KEY="));
   return line?.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/g,"") || "";
 }catch{return "";}
}
const omniKey=getOmniKey();
async function omniGenerate(params){
 if(params.responseFormat?.type!=="json_schema") throw new Error("OmniRoute callback expects JSON schema output");
 const schema=JSON.stringify(params.responseFormat.schema);
 const messages=[
  {role:"system",content:(params.systemPrompt||"")+"\nRespond with ONLY a valid JSON object matching this exact schema, without Markdown fences: "+schema},
  ...params.messages.map(m=>({role:m.role,content:(Array.isArray(m.content)?m.content:[m.content]).map(b=>b.type==="text"?b.text:b.type==="image"?"[Image omitted; use accessible page text]":"").join("\n")})),
 ];
 const response=await fetch("http://127.0.0.1:3001/v1/chat/completions",{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+omniKey},
   body:JSON.stringify({model:process.env.STAGEHAND_OMNI_MODEL||"glm-5.3-flash",messages,temperature:0,max_tokens:2500}),
   signal:AbortSignal.timeout(90000)
 });
 if(!response.ok) throw new Error("OmniRoute model request failed with HTTP "+response.status);
 const data=await response.json();
 const answer=data.choices?.[0]?.message?.content;
 if(typeof answer!=="string") throw new Error("OmniRoute returned no text");
 const cleaned=answer.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"");
 const parsed=JSON.parse(cleaned);
 return {role:"assistant",content:{type:"text",text:cleaned},outputFormat:"json_schema",structuredContent:parsed};
}
const needsAI=["act","observe","extract"].includes(command);
if(needsAI && !apiKey && !omniKey){
 console.error("AI_NOT_CONFIGURED: Set STAGEHAND_API_KEY and STAGEHAND_MODEL (or a supported provider key) in your shell; ChatGPT subscriptions do not include an API key.");
 process.exit(2);
}
if(command==="help"){
 console.log("Usage: node cli.mjs status|tabs|open <https://url>|act <single browser action>|observe <description>|extract <question>");
 process.exit(0);
}
let browser;
let stagehand;
try {
 browser=await localBrowser.connect({cdpUrl:"http://127.0.0.1:9228"});
 stagehand=await Stagehand.create({browser,...(apiKey?{model:{modelName,apiKey}}:omniKey?{model:{generate:omniGenerate}}:{})});
 const pages=await browser.context.pages();
 if(command==="status"){
   console.log(JSON.stringify({ok:true,stagehand:"4.3.0",modelConfigured:Boolean(apiKey||omniKey),modelSource:apiKey?"direct-provider":omniKey?"existing-local-omniroute":"none",tabs:pages.length,cdp:"localhost:9228"},null,2));
 } else if(command==="tabs"){
   const info=[];
   for(let i=0;i<pages.length;i++){
     try {info.push({index:i,title:await pages[i].title(),url:await pages[i].url()});}
     catch(e){info.push({index:i,error:String(e.message||e)});}
   }
   console.log(JSON.stringify(info,null,2));
 } else if(command==="open"){
   const target=new URL(args[0]);
   if(!["http:","https:"].includes(target.protocol)) throw new Error("Only HTTP(S) URLs are supported");
   const page=await browser.context.newPage();
   await page.goto(target.href);
   console.log(JSON.stringify({opened:await page.url(),title:await page.title()}));
 } else if(command==="act"){
   if(!args.length) throw new Error("Provide a single-action instruction");
   const out=await stagehand.act(args.join(" "));
   console.log(JSON.stringify(out.data,null,2));
 } else if(command==="observe"){
   if(!args.length) throw new Error("Provide an observation instruction");
   const out=await stagehand.observe(args.join(" "));
   console.log(JSON.stringify(out.data,null,2));
 } else if(command==="extract"){
   if(!args.length) throw new Error("Provide a question about the current page");
   const out=await stagehand.extract(args.join(" "),z.object({answer:z.string()}));
   console.log(JSON.stringify(out.data,null,2));
 } else {throw new Error("Unknown command: "+command);}
}catch(e){
 console.error("STAGEHAND_ERROR:",e.message||String(e));
 process.exitCode=1;
}finally{
 if(stagehand) await stagehand.close().catch(()=>{});
 // Stagehand 4.3.0 has no browser.disconnect() on a CDP-attached handle.
 // Exit this one-shot CLI to release its transport without closing Chrome.
}
process.exit(process.exitCode || 0);
