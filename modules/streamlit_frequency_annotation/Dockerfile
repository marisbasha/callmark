FROM continuumio/miniconda3

WORKDIR /app

RUN apt-get update && \
    apt-get install -y \
    libgl1 \
    libglx-mesa0 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN conda install python=3.10 -y 

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

CMD ["bash", "run.sh"]