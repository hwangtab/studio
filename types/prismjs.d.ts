// prismjs 언어 정의는 side-effect import로만 쓴다(MarkdownRenderer.tsx). 값은 참조하지 않으므로 unknown.
declare module 'prismjs/components/prism-javascript' {
    const content: unknown;
    export default content;
}

declare module 'prismjs/components/prism-typescript' {
    const content: unknown;
    export default content;
}

declare module 'prismjs/components/prism-jsx' {
    const content: unknown;
    export default content;
}

declare module 'prismjs/components/prism-css' {
    const content: unknown;
    export default content;
}

declare module 'prismjs/components/prism-bash' {
    const content: unknown;
    export default content;
}
