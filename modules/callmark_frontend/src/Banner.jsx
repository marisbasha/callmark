import React from "react";
import { Alert, AlertTitle } from "@mui/material";

function Banner({ title, message }) {
    return (
        <Alert
            severity="warning"
            variant="filled"
            sx={{
                position: "fixed",
                top: 16,
                right: 16,
                zIndex: (theme) => theme.zIndex.snackbar,
                borderRadius: 2,
                boxShadow: 3,
                "& .MuiAlertTitle-root": {
                    fontSize: "0.9rem",   // smaller title
                    marginBottom: 0.25,   // tighten spacing
                },
                "& .MuiAlert-message": {
                    fontSize: "0.8rem",   // smaller body
                },
            }}
        >
            <AlertTitle>{title}</AlertTitle>
            {message}
        </Alert>
    );
}

export default Banner;
