import {test} from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_MODE,MODES,MODE_STORAGE_KEY,modeLabelFa,parseMode} from "../lib/mode";

test("mode: labels map one to one onto the server preferences, in display order, with quality as the default",()=>{
 assert.deepEqual(MODES.map(m=>[m.labelFa,m.preference]),[["اقتصادی","cost"],["سریع","speed"],["با کیفیت","quality"]]);
 assert.equal(DEFAULT_MODE,"quality");assert.equal(MODE_STORAGE_KEY,"whoush-mode");
 assert.equal(modeLabelFa("speed"),"سریع");
 for(const bad of [null,undefined,"","fast","QUALITY",1,{}])assert.equal(parseMode(bad),"quality",String(bad));
 for(const m of MODES)assert.equal(parseMode(m.preference),m.preference);
});
