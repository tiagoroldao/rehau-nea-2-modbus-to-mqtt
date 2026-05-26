export function dptValueToDecimal(value: number) {
    if (value > 2048) {
        value = (value - 2048) * 2;
    }

	return value/100;
}

export function decimalToDpt(value: number) {
    value = value * 100;
    if (value > 2048) {
        value = value/2 + 2048;
    }
	
	return value;
}