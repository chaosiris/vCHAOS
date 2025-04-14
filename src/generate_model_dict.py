import os
import json

LIVE2D_DIR = './live2d_models'

def generate_model_dict(base_dir):
    """
    Generate/Update model_dict.json according to the latest Live2D models available in ./live2d_models.
    NOTE: idleMotion and tapMotion names are case-sensitive (has to be exactly same as the values in *.model3.json)!
    """
    model_dict = []

    if os.path.exists("model_dict.json"):
        try:
            with open("model_dict.json", "r", encoding="utf-8") as file:
                model_dict = json.load(file)
        except json.JSONDecodeError:
            print("> model_dict.json is empty or invalid. Initializing a new list.")

    for root, dirs, files in os.walk(base_dir):
        if root == base_dir:
            continue

        for file in files:
            if file.endswith(".model.json") or file.endswith(".model3.json"):
                model_name = os.path.basename(root)

                if file.endswith(".model3.json"):
                    file_prefix = file.split('.')[0]
                    
                    if model_name != file_prefix:
                        model_name = file_prefix

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
    generate_model_dict(LIVE2D_DIR)
    print("> model_dict.json has been updated.")
