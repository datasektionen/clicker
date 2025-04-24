defmodule ClickEx.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      ClickExWeb.Telemetry,
      ClickEx.Repo,
      {DNSCluster, query: Application.get_env(:click_ex, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: ClickEx.PubSub},
      # Start a worker by calling: ClickEx.Worker.start_link(arg)
      # {ClickEx.Worker, arg},
      # Start to serve requests, typically the last entry
      ClickExWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ClickEx.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ClickExWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
