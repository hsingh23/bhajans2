// @ts-nocheck
import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";
import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Terms of Service
        </Typography>
        
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Last updated: December 2024
        </Typography>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            Agreement to Terms
          </Typography>
          <Typography paragraph>
            By accessing or using Sing With Amma, you agree to be bound by these Terms of Service. 
            If you disagree with any part of these terms, you may not access the service.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Description of Service
          </Typography>
          <Typography paragraph>
            Sing With Amma provides a digital platform for searching and viewing bhajan lyrics and sheet music. 
            The service includes access to PDF songbooks and audio samples.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Subscription and Payment
          </Typography>
          <Typography paragraph>
            Access to the full service requires a paid subscription. Subscriptions are processed through PayPal.
            Subscription fees are non-refundable except as required by applicable law.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Intellectual Property
          </Typography>
          <Typography paragraph>
            All content, including bhajan lyrics, sheet music, and audio samples, is the property of MA Center and Amrita Books.
            Users may not reproduce, distribute, or create derivative works without explicit permission.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            User Conduct
          </Typography>
          <Typography paragraph>
            You agree not to:
          </Typography>
          <ul>
            <li><Typography>Share your account credentials with others</Typography></li>
            <li><Typography>Download or distribute content for commercial purposes</Typography></li>
            <li><Typography>Attempt to circumvent security measures</Typography></li>
            <li><Typography>Use the service for any unlawful purpose</Typography></li>
          </ul>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Offline Access
          </Typography>
          <Typography paragraph>
            The service provides offline access to previously viewed content for active subscribers.
            Offline access is limited to 3 months from the last online session or until subscription expiry, whichever comes first.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Termination
          </Typography>
          <Typography paragraph>
            We reserve the right to terminate or suspend your account at any time for violations of these terms.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Disclaimer
          </Typography>
          <Typography paragraph>
            The service is provided &quot;as is&quot; without warranties of any kind. 
            We do not guarantee uninterrupted access to the service.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Contact
          </Typography>
          <Typography paragraph>
            For questions about these terms, please contact us through MA Center.
          </Typography>

          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Link to="/" style={{ color: "inherit" }}>
              ← Back to Home
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Terms;
