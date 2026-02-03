export const equipment = {
    microphones: [
        "Neumann U87AI",
        "AKG C414 XLS",
        "Studio Project C1",
        "Beyerdynamic TG-X81",
        "Shure SM58",
        "Shure SM57",
    ],
    preamps: ["Vintech X73i Preamp", "Focusrite Saffire Octopre"],
    equalizers: ["SPL Optimizer Parametric Equalizer"],
    compressors: ["Tegeler Vari Tube Compressor", "Alctron Cp540v2"],
    interfaces: ["Prism Sound Lyra 2", "Arturia X8 OUT"],
    processors: ["Solid State Logic Fusion", "Lexicon MX300"],
    speakers: ["Proac Tablett 50", "EVE Audio SC207", "ADAM Audio A5"],
    headphones: [
        "Sennheiser HD600",
        "Sony MDR-7506",
        "Calyx H",
        "SHURE SRH 440",
    ],
    instruments: [
        "Vox AC30 Guitar Amp",
        "Yamaha U3 Piano",
        "Yamaha U1 Piano",
        "Gibson J-15",
        "G&L Tribute ASAT",
    ],
    consoles: [
        "Softube Console 1",
        "Softube Console 1 Fader",
        "Presonus Faderport V2",
    ],
    synthesizers: [
        "Spectrasonics",
        "Spitfire Audio",
        "Native Instruments",
        "u-he",
        "Arturia",
        "UJAM",
        "Moog",
    ],
    plugins: [
        "UAD",
        "Acustica Audio",
        "Softube",
        "Soundtoys",
        "Izotope",
        "Sonnox 등 다수",
    ],
} as const;

export const studioImages = [
    { src: "/images/hardware2.jpg", alt: "Neumann U87AI 콘덴서 마이크와 Vintech 프리앰프" },
    { src: "/images/hardware3.jpg", alt: "API 550B EQ와 SSL Fusion 컴프레서" },
    { src: "/images/hardware4.jpg", alt: "Universal Audio Apollo x8p 오디오 인터페이스" },
    { src: "/images/hardware5.jpg", alt: "Adam Audio A7X 모니터 스피커와 믹싱 데스크" },
] as const;

