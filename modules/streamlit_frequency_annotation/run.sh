#!/bin/bash

streamlit run app.py --server.port 8081 -- --backend_flask_port 8080 --callmark_server_address $CALLMARK_FRONTEND_SERVICE --vocallbase_service ${VOCALLBASE_SERVICE}