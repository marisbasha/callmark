# CallMark

# Installation

- System Requirements:
    
    OS: Ubuntu, Linux, or Mac OS 
    
    GPU requirements:
    - GPU needs to be compatible with CUDA 12.1. This covers commonly used GPUs such as RTX series (RTX 20/30/40 series, except for RTX 50 series) and Data Center GPUs (A100, H100, T4, etc.)
    - 10 GB RAM for finetuning WhisperSeg base model or just inference
    - 40 GB RAM for finetuning WhisperSeg large model
    - No GPU needed if the WhisperSeg function is not needed (e.g. for developing CallMark frontend only)
- Installation Steps:
    1. Install Docker and Docker Compose
        * For Ubuntu/Linux, please refer to https://docs.docker.com/engine/install/ubuntu/ for installation
          
          On Ubuntu, after installing docker, you can add user to docker group, to be able to call docker without type in 'sudo':
          ```bash
            sudo usermod -aG docker $USER
            newgrp docker
          ```
        * For Mac OS, please refer to https://docs.docker.com/desktop/setup/install/mac-install/ for installation
        
    2. Configure GPU support for Docker
        * For Mac OS or machines without GPU, skip this GPU configuration and directly go to the next step
        * For Ubuntu/Linux, please refer to https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html
        * After installing nvidia-container-toolkit, **configure the config file for nvidia-container-toolkit:**
            Open the following file using your editor (like gedit, vim, or nano), 
 
            ```
            /etc/nvidia-container-runtime/config.toml
            ```
            
            then set the parameter
            ```
            no-cgroups = false
            ```
            
            After this then restart docker service
            ```
            sudo systemctl restart docker
            ```
            This is needed to avoid the CUDA "NVML: Unknown Error", according to https://forums.developer.nvidia.com/t/nvida-container-toolkit-failed-to-initialize-nvml-unknown-error/286219/3
        
      
       * **Troubleshoot**
        
            - If you encounter the package conflicting error when running "apt-get update": E: Conflicting values set for option Signed-By regarding source ... (See [https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/troubleshooting.html#conflicting-values-set-for-option-signed-by-error-when-running-apt-update](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/troubleshooting.html#conflicting-values-set-for-option-signed-by-error-when-running-apt-update) for the details.), run the following command:
        
                ```bash
                sudo rm $(grep -l "nvidia.github.io" /etc/apt/sources.list.d/* | grep -vE "/nvidia-container-toolkit.list\$")
                ```
 

        
    3. Clone this CallMark repository at https://gitlab.uzh.ch/nccr-evolving-language/ttf-datascience/callmark

       To Clone the repository you need to be a member of the GitLab group: https://gitlab.uzh.ch/nccr-evolving-language To become a member of this group, please contact administrators: Richard Hahnloser (rich@ini.ethz.ch) or Guanghao You (guanghao.you@uzh.ch).
        ```bash
        git clone https://gitlab.uzh.ch/nccr-evolving-language/ttf-datascience/callmark.git
        ```
# Preparation Before Launching
## Configure CallMark WhisperSeg User Tokens
We use authorization tokens to control the access to WhisperSeg function on CallMark. To use WhisperSeg on CallMark for human-in-the-loop annotation, users need to contact the maintainer to get a token. With the user token, you can control who can use WhisperSeg, and whether they can use WhisperSeg only for inference or they can also finetune new models. 

The user token configuration file is at "callmark_whisperseg_users.yaml". It looks like below:
```yaml
users:
  admin:       #The user token is "admin", users can just type in "admin" in the pop-out authentication window when they use whisperseg on CallMark
    info: ""   # Some information about this user, such as Name, or research group information, etc
    inference: true   #This user can run WhisperSeg for inference
    train: true       #This user can finetune new WhisperSeg on CallMark
    is_admin: true    #This user is an admin user. It can see the models finetuned by all users
  user_token_2:
    info: ""
    inference: true
    train: true
    is_admin: false   #This user can only see models finetuned by itself.
  user_token_3:
    info: ""
    inference: true
    train: false      #This user cannot finetune new WhisperSeg models on CallMark
    is_admin: false
```
When a new user want to use WhisperSeg function, you can provide the user with an existing token from the list, or you can add a new entry in the yaml file and share the new token.

**WARNING:** The current items stored in callmark_whisperseg_users.yaml are the real users who are currently using CallMark through https://annotation.evolvinglanguage.ch/, PLEASE DO NOT OVERWRITE IT if you are the maintainer of CallMark at NCCR@LiRI!

You can customize callmark_whisperseg_users.yaml if you set up CallMark on your own system and have no interaction with the running CallMark at NCCR@LiRI.


## Configure environment variables

CallMark consists of several modules:
1. WhisperSeg
2. CallMark React Frontend
3. CallMark Python Flask Backend
4. Streamlit APP used for annotating frequency in a centralized platform
5. Streamlit APP used for plotting the figure of example vocalizations (Figure M2 in the general handout)

Different modules inter-connect with each other, and to make the system work you need to configure the following environment variables listed in the file "environments.cfg":
* **DATA_FOLDER**: 
    - Description: The folder that stores the temporary data required by the WhisperSeg module. For example, when user use CallMark to finetune whisperseg, the audio and annotation used for finetuning will be stored here. <br>
    - Default: *storage/whisperseg/data* (Relative path inside the base folder of this repo, you can also specify somewhere else)
* **MODEL_FOLDER**: 
    - Description: The folder that stored the checkpoint of the finetuned WhisperSeg model. 
    - Default: *storage/whisperseg/model*
* **WHISPERSEG_USER_CONFIG_FILE**:
    - Description: The file that stored the user token information for controlling the access to using WhisperSeg function inside CallMark. 
    - Default: *callmark_whisperseg_users.yaml*
* **CALLMARK_BACKEND_DATA_FOLDER**:
    - Description: The folder that stores some temporary data required by CallMark. For example, when user uploads a audio file to CallMark, the audio file will be stored here temporarily for internal computation. 
    - Default: *storage/callmark_backend/data*
* **NODE_ENV**:
    - Description: A flag variable that is used to inform docker compose whether it is in "production" mode or "development" mode when building. When debugging and modifying code, it is recommended to set NODE_ENV as "development". This way CallMark will run "npm run dev" when starting, which is more efficient. When deploying the system to a server, set NODE_ENV to "production" then CallMark will run "npm run build" first before launching.
    - Default: *production*
* **WHISPERSEG_PORT**:
    - Description: This is a port number pointing to WhisperSeg Flask service. <br>
    Assign a unused port to this variable. For example, after setting WHISPERSEG_PORT as 8500, as a maintainer, you can directly run segmentation or training new model by sending http request through this address: http://localhost:8500
    - Default: *8500*
* **WHISPERSEG_STREAMLIT_PORT**:
    - Description: This is a port number pointing to a streamlit App that runs WhisperSeg. On this app users can upload audios to run segmentation, or upload a list of audio and csv pairs to finetune a new whisperseg model. It is currently used by Megan Wyman from Marta's group (for meerkat) and Melissa Berthet from Judith's group for marmoset. <br>
    Assign a unused port to this variable. For example, after setting WHISPERSEG_STREAMLIT_PORT as 8506, you can access the streamlit app at http://localhost:8506
    - Default: *8506*   (We use 8506 as the port because some groups in NCCR are using the streamlit app through this port, so it is good to keep it unchanged.)
* **CALLMARK_BACKEND_PORT**:
    - Description: CallMark consists of a React frontend and a Python Flask backend. This port refers to the port that the backend flask server listens to. 
    - Default: *8502*
* **CALLMARK_FRONTEND_PORT**:
    - Description: CallMark consists of a React frontend and a Python Flask backend. This port refers to the port that the React frontend listens to. For example if it is 8503, then CallMark is running at http://localhost:8503
    - Default: *8503*
* **FREQUENCY_ANNOTATION_PORT**:
    - Description: This is the port to the streamlit APP for annotating frequency in a centralized platform. For example after setting it to 8504, the streamlit APP will run at http://localhost:8504
    - Default: *8504*
* **EXAMPLE_FIGURE_PLOT_PORT**:
    - Description: This is the port to the streamlit APP for plotting the figure of example vocalizations. For example after setting it to 8505, the streamlit APP will run at http://localhost:8505
    - Default: *8505*
* **CALLMARK_BACKEND_SERVICE**:
    - Description: The service address of the Flask server of CallMark backend. This value depends on how you want CallMark to be used:
        - If you want to use CallMark just at the machine where CallMark is installed, then simply set this variable to http://localhost:8502 (suppose you are using 8502 for CALLMARK_BACKEND_PORT)
        - If you want CallMark can be accessed globally on the internet, you need to assign a https:// domain name to **BOTH** the CallMark frontend and CallMark backend. For example, in our running CallMark at NCCR@LiRI, we assign a domain name https://anno-backend.evolvinglanguage.ch/ to CallMark backend (http://localhost:8502), then the value of CALLMARK_BACKEND_SERVICE **MUST** be https://anno-backend.evolvinglanguage.ch/
    - Default: 
        - *http://localhost:8502* if using CallMark just locally
        - *https://anno-backend.evolvinglanguage.ch/* Your own domain name for backend service if you want CallMark to be accessible globally
* **CALLMARK_FRONTEND_SERVICE**:
    - Description: The service address of the Flask server of CallMark frontend. This value depends on how you want CallMark to be used:
        - If you want to use CallMark just at the machine where CallMark is installed, then simply set this variable to http://localhost:8503 (suppose you are using 8503 for CALLMARK_FRONTEND_PORT)
        - If you want CallMark can be accessed globally on the internet, you need to assign a https:// domain name to **BOTH** the CallMark frontend and CallMark backend. For example, in our running CallMark at NCCR@LiRI, we assign a domain name https://annotation.evolvinglanguage.ch/ to CallMark frontend (http://localhost:8503), then the value of CALLMARK_FRONTEND_SERVICE **MUST** be https://annotation.evolvinglanguage.ch/
    - Default: 
        - *http://localhost:8503* if using CallMark just locally
        - *https://annotation.evolvinglanguage.ch/* Your own domain name for react frontend service if you want CallMark to be accessible globally
* **VOCALLBASE_SERVICE**:
    - Description: The service address of vocallbase. This address is needed only if your CallMark need to connect to Vocallbade to directly load audio from vocallbase and submit annotations to vocallbase. If you only want to use CallMark to upload an audio locally and download the CSV after annotation, you can set this variable to "NONE".  **Note:** Setting VOCALLBASE_SERVICE to NONE means that you can only use CallMark and WhisperSeg. The streamlit APP for annotating frequency and plotting the figure of example vocalizations will not work in this case.
        - Currently Vocallbase is running at https://vocallbase.evolvinglanguage.ch/ is maintained by Sumit Ram (sumitram.ram@uzh.ch). If you need to set up vocallbase on you own machine as well, please contact Sumit for further details.
    - Default: 
        - https://vocallbase.evolvinglanguage.ch/ if you are the maintainer of current setup of CallMark at NCCR@LiRI
        - your own domain name or localhost if you set up VocallBase at your own machine as well
        - NONE if you do not need vocallbase and only want to use CallMark and WhisperSeg for annotation

**Summary**

If you just want to set up CallMark and WhisperSeg on your local machine, set the environments.cfg as below:
```
DATA_FOLDER=storage/whisperseg/data
MODEL_FOLDER=storage/whisperseg/model
WHISPERSEG_USER_CONFIG_FILE=callmark_whisperseg_users.yaml
CALLMARK_BACKEND_DATA_FOLDER=storage/callmark_backend/data
NODE_ENV=production
WHISPERSEG_STREAMLIT_PORT=8501
CALLMARK_BACKEND_PORT=8502
CALLMARK_FRONTEND_PORT=8503
FREQUENCY_ANNOTATION_PORT=8504
EXAMPLE_FIGURE_PLOT_PORT=8505
CALLMARK_BACKEND_SERVICE=http://localhost:8502
CALLMARK_FRONTEND_SERVICE=http://localhost:8503
VOCALLBASE_SERVICE=None
```
If you are the maintainer of current CallMark running at NCCR@LiRI, set the environments.cfg as below:
```
DATA_FOLDER=storage/whisperseg/data
MODEL_FOLDER=storage/whisperseg/model
WHISPERSEG_USER_CONFIG_FILE=callmark_whisperseg_users.yaml
CALLMARK_BACKEND_DATA_FOLDER=storage/callmark_backend/data
NODE_ENV=production
WHISPERSEG_STREAMLIT_PORT=8501
CALLMARK_BACKEND_PORT=8502
CALLMARK_FRONTEND_PORT=8503
FREQUENCY_ANNOTATION_PORT=8504
EXAMPLE_FIGURE_PLOT_PORT=8505
CALLMARK_BACKEND_SERVICE=https://anno-backend.evolvinglanguage.ch/
CALLMARK_FRONTEND_SERVICE=https://annotation.evolvinglanguage.ch/
VOCALLBASE_SERVICE=https://vocallbase.evolvinglanguage.ch/
```
If you set up CallMark, WhisperSeg, and VocallBase all on your own system and have you own domain names, set environments.cfg as:
```
DATA_FOLDER=storage/whisperseg/data
MODEL_FOLDER=storage/whisperseg/model
WHISPERSEG_USER_CONFIG_FILE=callmark_whisperseg_users.yaml
CALLMARK_BACKEND_DATA_FOLDER=storage/callmark_backend/data
NODE_ENV=production
WHISPERSEG_STREAMLIT_PORT=8501
CALLMARK_BACKEND_PORT=8502
CALLMARK_FRONTEND_PORT=8503
FREQUENCY_ANNOTATION_PORT=8504
EXAMPLE_FIGURE_PLOT_PORT=8505
CALLMARK_BACKEND_SERVICE=https://<your domain name for callmark backend>
CALLMARK_FRONTEND_SERVICE=https://<your domain name for callmark frontend>
VOCALLBASE_SERVICE=https://<your domain name for vocallbase>
```

# Launch CallMark

On Ubuntu/Linux machine with GPU, run
```bash
docker compose --env-file environments.cfg --profile gpu up --build -d
```

On MacOS, run
```bash
docker compose --env-file environments.cfg --profile cpu up --build -d
```
Note: 
* For the first time running the command, docker compose will install the environment for each module, and this will takes longer. 
* Sometimes when running the command (especially on MacOS) you will see some installation errors caused by pip or conda. Please make sure your machine is connected to network, and just rerun the command until the error is gone.
* After launching, CallMark will run at the ports specified by you in the environments.cfg file.

# Stop CallMark
You can manually stop the CallMark docker service by
```bash
docker compose --env-file environments.cfg --profile gpu down 
``` 
or 
```bash
docker compose --env-file environments.cfg --profile cpu down 
```

For further information about the usage of docker compose, please refer to https://docs.docker.com/compose/gettingstarted/

# Allocate Domain Names for CallMark (Confidential)

Here are the information on how to make CallMark accessible through a https domain name, under the current infrastructure at NCCR@LiRI.

## Overview of the Infrastructure Setting
* Workstation at NCCR@LiRI
    At NCCR@LiRI, CallMark is running at the workstation "wks-nccr-liri.ifi.uzh.ch":
    * Location: Institut für Informatik Universität Zürich, Binzmühlestrasse 14, 8050 Zürich
    * IP (internal): 130.60.61.9
    * Contact Person: Guanghao You (guanghao.you@uzh.ch), Stefan Bircher(stefan.bircher@uzh.ch)
    * Specs: high-end deep learning workstation, 512 RAM, 2x RTX A6000 (48GB) GPUs
    * Network: Only be accessible through UZH VPN
    * User Information:
        - Username: **callmark**
        - Password: available at "TTF Datascience@LiRi" Teams Channel, inside folder "Nianlong Gu/NCCR-LIRI-workstation/Info.docx"
    * Localtion of CallMark: /home/callmark/projects/callmark
* Google Cloud VM
    We have a Google cloud virtual machine named "annotation-server" running at the project "audio-segmentation-model", which has a public IP. Here are the information of it:
    * Location: Google Cloud, organization evolvinglanguage.ch
    * Public IP: 34.65.142.108
    * Contact Person: Guanghao You (guanghao.you@uzh.ch)
    * Specs: A small-scale CPU machine with 8GB CPU RAM, no GPU

## Mapping CallMark to Public IP
The wks-nccr-liri workstation is behind UZH VPN and does not have a public IP, therefore it is not possible to directly allocate a public domain name to it. To achieve so, one need to contact the IT service of the Institut für Informatik, but we chose another option based on the current resources we have:

Suppose CallMark frontend is running at port 8503 on wks-nccr-liri workstation, on wks-nccr-liri, we run `gcloud compute ssh` to forward the local port '8503' to a free port (e.g., 5050) on the Google VM "annotation-server". With this setting, the CallMark frontend is accssible at http://34.65.142.108:5050, then we can allocate a domain name to this IP+Port, such as http://annotation.evolvinglanguage.ch/. Then we can obtain a SSL certificate to finally get a HTTPS domain name: https://annotation.evolvinglanguage.ch/. The same procedure applies to the CallMark backend service, as well as Streamlit APPs.

## Detailed Configuration
For the maintenance of the current CallMark at https://annotation.evolvinglanguage.ch/, please check the following steps:
1. Make sure the Google VM "annotation-server" is always running and do not change its public IP
2. On wks-nccr-liri workstation, running the following command in the background (You can create a new screen using the 'screen' command, and run the command inside the screen):
    ```bash
    gcloud compute ssh --zone "europe-west6-a" "annotation-server" --project "audio-segmentation-model" -- -N -R 0.0.0.0:5050:localhost:8503 -R 0.0.0.0:8050:localhost:8502 -R 0.0.0.0:8051:localhost:8505 -R 0.0.0.0:8052:localhost:8504
    ```

    Explanation of this command:
    * CallMark frontend port 8503 mapped to http://34.65.142.108:5050
    * CallMark backend port 8502 mapped to http://34.65.142.108:8050
    * Streamlit APP for plotting the figure of example vocalizations (Figure M2) is mapped to http://34.65.142.108:8051
    * Streamlit APP for annotating frequency is mapped to http://34.65.142.108:8052

    **Note: GCloud credential required for this command.** Currently the google cloud credential is Nianlong Gu's account. Once this credential needs to be renewed, please contact the Google Cloud administrator Guanghao You (guanghao.you@uzh.ch) for support. 

**The following steps are configured and maintained by Sumit Ram and Guanghao You, please contact them for further details**

3. Create a domain name xxx.evolvinglanguage.ch/ for each of the mapped ports:
    - annotation.evolvinglanguage.ch -> http://34.65.142.108:5050
    - anno-backend.evolvinglanguage.ch -> http://34.65.142.108:8050
    - https://vocallvisual.evolvinglanguage.ch -> http://34.65.142.108:8051
    - http://annotationbrowser.evolvinglanguage.ch -> http://34.65.142.108:8052

4. Use Certbot to get the SSL certificate to enable HTTPS domain name

# Other Information
## Network Issue of wks-nccr-liri workstation

On the workstation nccr-at-liri, the DNS server cannot resolve the IP address of https://vocallbase.evolvinglanguage.ch. To resolve this issue, I have manually inserted the mapping in the following way: 
```bash
sudo bash -c 'echo "34.65.72.63 vocallbase.evolvinglanguage.ch" >> /etc/hosts' 
```
If in the future the IP address associated with https://vocallbase.evolvinglanguage.ch changes, this record in /etc/hosts should also be changed. 

## CallMark after system reboot
If your docker engine will automatically start when system reboots, this CallMark docker services will automatically launch after system reboot.  
The only thing you need to do is to re-set up the gcloud ssh port forwarding to make CallMark publically accessible at https://annotation.evolvinglanguage.ch/

In these cases, do the following steps: 
1. connect to the wks-nccr-liri workstation:
```bash
ssh callmark@wks-nccr-liri.ifi.uzh.ch 
```
Password: available at "TTF Datascience@LiRi" Teams Channel, inside folder "Nianlong Gu/NCCR-LIRI-workstation/Info.docx"
2. After entering the workstation terminal, run 
```bash
screen -S gcloud 
```
This will create a new screen named "gcloud"
3. Inside the screen, run the gcloud compute ssh command:
```bash 
gcloud compute ssh --zone "europe-west6-a" "annotation-server" --project "audio-segmentation-model" -- -N -R 0.0.0.0:5050:localhost:8503 -R 0.0.0.0:8050:localhost:8502 -R 0.0.0.0:8051:localhost:8505 -R 0.0.0.0:8052:localhost:8504
```
4. exit the screen by press Ctrl + A + D
5. If you want to re-enter the "gcloud" screen, in the terminal, run 
```bash
screen -d -r gcloud
```
For more details of using screen command, please refer to https://www.geeksforgeeks.org/linux-unix/screen-command-in-linux-with-examples/

# Troubleshooting
* When the service is not running, or certain functions like WhisperSeg is not available, try to restart the docker services:

  On GPU machine:
  ```bash
  docker compose --env-file environments.cfg --profile gpu restart
  ```

  On CPU machine:
  ```bash
  docker compose --env-file environments.cfg --profile cpu restart
  ```
Update: added a health check function to restart docker automatically when CUDA access is broken: https://stackoverflow.com/a/76646962/11998352

* **Upload by URL fails at ~26% (or any percentage during download/processing) when accessed through the public domain (e.g., https://annotation.evolvinglanguage.ch)**

  This is caused by the nginx reverse proxy on the Google Cloud VM `annotation-server` (34.65.142.108) timing out. The backend processes large audio files (1GB+) and during stages like audio format conversion there can be long periods (60-90 seconds) with no data sent on the SSE stream. The default nginx `proxy_read_timeout` of 60 seconds kills the connection.

  **Fix:** SSH into `annotation-server` and update the nginx config:
  ```bash
  gcloud compute ssh annotation-server --zone=europe-west6-a
  sudo nano /etc/nginx/sites-enabled/anno-backend
  ```

  Add these lines inside the `location /` block:
  ```nginx
  # Timeout settings for large file processing (20 minutes)
  proxy_read_timeout 1200s;
  proxy_send_timeout 1200s;
  proxy_connect_timeout 60s;

  # Disable buffering for SSE streams
  proxy_buffering off;
  proxy_cache off;
  ```

  Then test and restart nginx:
  ```bash
  sudo nginx -t
  sudo systemctl restart nginx
  ```

  **Note:** This issue only affects access through the public domain. Uploading locally (e.g., http://localhost:8502) works fine because there is no nginx proxy in between.

# Contacts
Richard Hahnloser: rich@ini.ethz.ch

Maris Basha: maris@ini.ethz.ch

Guanghao You: guanghao.you@uzh.ch

Sumit Ram: sumitram.ram@uzh.ch

Alon Cohen: alon.cohen@uzh.ch

Nianlong Gu: nianlong.gu@uzh.ch