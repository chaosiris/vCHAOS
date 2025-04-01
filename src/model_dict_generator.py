import os
import json

BASE_DIRECTORY = './live2d_models'

def generate_model_dict(base_dir):
    model_dict = []

    if os.path.exists("model_dict.json"):
        with open("model_dict.json", "r", encoding="utf-8") as file:
            model_dict = json.load(file)

    for root, dirs, files in os.walk(base_dir):
        if root == base_dir:
            continue

        for file in files:
            if file.endswith(".model.json") or file.endswith(".model3.json"):
                model_name = os.path.basename(root)
                file_path = os.path.join(root, file)
                file_path = file_path.replace(os.sep, '/')

                if not any(model['file_path'] == file_path for model in model_dict):
                    model_dict.append({
                        "name": model_name,
                        "file_path": file_path,
                        "kScale": 0.2,
                        "xOffset": 0,
                        "yOffset": 0,
                        "idleMotion": "idle",
                        "idleMotionCount": 1,
                        "tapMotion": "tap",
                        "tapMotionCount": 1
                    })

    with open("model_dict.json", "w", encoding="utf-8") as file:
        json.dump(model_dict, file, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    generate_model_dict(BASE_DIRECTORY)
    print("model_dict.json has been updated.")
