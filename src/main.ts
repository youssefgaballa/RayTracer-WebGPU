import "./style.css";

const output_label: HTMLElement = document.getElementById(
  "compatibility-label",
) as HTMLElement;

if (navigator.gpu) {
  output_label.innerText = "WebGPU is supported on this browser";
} else {
  output_label.innerText = "WebGPU is not supported on this browser";
}