FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Flownest.sln ./
COPY src/Flownest.Domain/Flownest.Domain.csproj src/Flownest.Domain/
COPY src/Flownest.Application/Flownest.Application.csproj src/Flownest.Application/
COPY src/Flownest.Infrastructure/Flownest.Infrastructure.csproj src/Flownest.Infrastructure/
COPY src/Flownest.Api/Flownest.Api.csproj src/Flownest.Api/
COPY tests/Flownest.Tests/Flownest.Tests.csproj tests/Flownest.Tests/
RUN dotnet restore src/Flownest.Api/Flownest.Api.csproj

COPY . .
RUN dotnet publish src/Flownest.Api/Flownest.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Flownest.Api.dll"]
