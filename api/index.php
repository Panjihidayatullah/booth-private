<?php

// Normalize SCRIPT_NAME so Laravel doesn't treat /api as application subfolder
$_SERVER['SCRIPT_NAME'] = '/index.php';

// Forward Vercel requests to Laravel's public/index.php
require __DIR__ . '/../public/index.php';
