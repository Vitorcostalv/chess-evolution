// Register only the Layers API, its gradients and the two browser backends.
// The umbrella package also ships Node CLI/data/converter dependencies we do not use.
import "@tensorflow/tfjs-core/dist/base_side_effects";
import "@tensorflow/tfjs-core/dist/register_all_gradients";
import "@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
export * from "@tensorflow/tfjs-core";
export * from "@tensorflow/tfjs-layers";
