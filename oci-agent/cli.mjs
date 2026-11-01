import {localBrowser,Stagehand} from "@browserbasehq/stagehand";
import {z} from "zod";
const command=process.argv[2] || "status";
const args=process.argv.slice(3);
const apiKey=process.env.STAGEHAND_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.OPENAI_API_KEY;
const modelName=process.env.STAGEHAND_MODEL || (process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "google/gemini-2.5-flash" : "openai/gpt-4o-mini");
const needsAI=["act","observe","extract"].includes(command);
if(needsAI && !apiKey){
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
 stagehand=await Stagehand.create({browser,...(apiKey?{model:{modelName,apiKey}}:{})});
 const pages=await browser.context.pages();
 if(command==="status"){
   console.log(JSON.stringify({ok:true,stagehand:"4.3.0",modelConfigured:Boolean(apiKey),tabs:pages.length,cdp:"localhost:9228"},null,2));
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
 if(browser && typeof browser.disconnect==="function") await browser.disconnect().catch(()=>{});
}
