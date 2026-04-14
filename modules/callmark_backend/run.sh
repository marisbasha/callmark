#!/bin/bash

python backend.py -flask_port 8080 -segmentation_service_address $WHISPERSEG_SERVICE -vocallbase_service_address $VOCALLBASE_SERVICE -freq_anno_hash_id_service_address $FREQUENCY_ANNOTATION_SERVICE -whisperseg_config_file_path $WHISPERSEG_USER_CONFIG_FILE -chunk_save_folder ${DATA_FOLDER}/temp/chunks/