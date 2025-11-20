"use strict";(()=>{var e={};e.id=660,e.ids=[660],e.modules={5949:(e,r,s)=>{s.r(r),s.d(r,{default:()=>d});var t=s(997),a=s(6859);let o=`
(function() {
  try {
    var storageKey = 'darkMode';
    var storedPreference = localStorage.getItem(storageKey);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);
    document.documentElement.classList.toggle('dark', shouldUseDark);
  } catch (error) {
    console.warn('theme init failed', error);
  }
})();
`;function d(){return(0,t.jsxs)(a.Html,{lang:"ko",className:"scroll-smooth",children:[t.jsx(a.Head,{children:t.jsx("script",{dangerouslySetInnerHTML:{__html:o}})}),(0,t.jsxs)("body",{className:"bg-white dark:bg-gray-900",children:[t.jsx(a.Main,{}),t.jsx(a.NextScript,{})]})]})}},2785:e=>{e.exports=require("next/dist/compiled/next-server/pages.runtime.prod.js")},6689:e=>{e.exports=require("react")},997:e=>{e.exports=require("react/jsx-runtime")},5315:e=>{e.exports=require("path")}};var r=require("../webpack-runtime.js");r.C(e);var s=e=>r(r.s=e),t=r.X(0,[567,859],()=>s(5949));module.exports=t})();