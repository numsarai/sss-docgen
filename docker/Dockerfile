FROM onlyoffice/documentserver

# Copy custom fonts
COPY fonts/ /usr/share/fonts/custom/

# Rebuild font cache so OnlyOffice picks them up
RUN fc-cache -f && /usr/bin/documentserver-generate-allfonts.sh
