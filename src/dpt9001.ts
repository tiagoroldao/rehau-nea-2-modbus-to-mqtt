export function dptValueToDecimal(value: number) {
    if (value > 2048) {
        value = (value - 2048) * 2;
    }
	
	return value/100;
}

console.log(dptValueToDecimal(3098))