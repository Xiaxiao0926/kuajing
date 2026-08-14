// 测试跨行${}在模板字符串中
const x = 1;
const y = `
    <span class="${
        x === 1 ? 'a' :
        x === 2 ? 'b' : 'c'
    }">${x}</span>
`;
console.log('OK:', y);
