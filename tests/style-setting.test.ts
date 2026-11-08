import {test} from "node:test";
import assert from "node:assert/strict";
import {AUTO_STYLE_FA,STYLE_OPTIONS,STYLE_STORAGE_KEY,parseStyle,styleLabelFa} from "../lib/style-setting";
import {GENERATION_STYLES,STYLE_LABEL_FA} from "../lib/creative-plan";

test("style setting: اتوماتیک plus the three styles, titles from the style table, unknown values fall back to اتوماتیک",()=>{
 assert.equal(STYLE_STORAGE_KEY,"whoush-style");assert.equal(AUTO_STYLE_FA.titleFa,"اتوماتیک");
 assert.deepEqual(STYLE_OPTIONS.map(o=>o.style),[...GENERATION_STYLES]);
 assert.deepEqual(STYLE_OPTIONS.map(o=>o.titleFa),GENERATION_STYLES.map(s=>STYLE_LABEL_FA[s]));
 assert.deepEqual(STYLE_OPTIONS.map(o=>o.hintFa),["مثل عکس واقعی، بافت و نور طبیعی","رندر سه‌بعدی تمیز","کارتونی و رنگی"]);
 for(const s of GENERATION_STYLES){assert.equal(parseStyle(s),s);assert.equal(styleLabelFa(s),STYLE_LABEL_FA[s]);}
 for(const bad of [null,undefined,"","3d","REALISTIC",1,{}])assert.equal(parseStyle(bad),null,String(bad));
 assert.equal(styleLabelFa(null),"اتوماتیک");
});
