import { useDebug } from "./config";


export function log(...args: any[]) {
  useDebug && console.log(...args);
}